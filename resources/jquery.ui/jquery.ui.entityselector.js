/**
 * Wikibase entity selector
 * Allows searching for entities by typing into an input field encapsulating auto-complete
 * functionality and offering suggestions in a list below the input box.
 * @since 0.2
 * @file
 * @ingroup WikibaseLib
 * @licence GNU GPL v2+
 * @author H. Snater < mediawiki@snater.com >
 *
 * @example $( 'input' ).entityselector( {
 *   url: <url to retrieve results from>,
 *   language: <language to fetch results in>
 * } );
 * @desc Creates a simple entity selector fetching items.
 *
 * @option url {String} URL to retrieve results from.
 *
 * @option language {String} Code of the language results shall be fetched in.
 *
 * @option type {String} (optional) Entity type that will be queried for results.
 *         Default value: 'item'
 *
 * @option limit {Number} (optional) Number of results to query the API for.
 *         Default value: null (will pick limit specified server-side)
 *
 * @option maxItems {Number} (optional) If the number of suggestions is higher than maxItems,
 *         the suggestion list will be made scrollable.
 *         Default value: 10
 *
 * @option selectOnAutocomplete {Boolean} (optional) Trigger 'select' event when auto-completing
 *         the input value to the first suggestion.
 *         Default value: false
 *
 * @option handles {String} (optional) Passed to jquery.ui.resizable, this parameter specifies
 *         the borders where resize handles should be placed (e.g. 'e' stands for east). For rtl
 *         languages, the parameter should be set to 'w'.
 *         @see ui.resizable.options.handles
 *         Default value: 'e'
 *
 * @option timeout {Number} (optional) AJAX timeout in milliseconds.
 *         Default value: 8000
 *
 * @option messages {Object} (optional) Strings used within the widget.
 *         Within a MediaWiki/Wikibase context (if mediawiki and/or wikibase JS objects are
 *         defined), the messages will be fetched from the MediaWiki message store. First, by
 *         prefixing the key with 'wikibase-', second without prefix. If no message can be found
 *         via the messaging system, the default message specified in this option will be used.
 * @option messages['aliases-label'] {String} (optional) Label prepending the alias(es) if there is
 *         a search hit on at least one alias of an entity.
 *         Default value: 'also known as:'
 *
 * @event response Triggered after an API request has been received successfully.
 *        Parameters: (1) {jQuery.Event}
 *                    (2) {Array} Entity data
 *
 * @event aftersetentity Triggered after an entity has been set using selectedEntity( <entity id> ).
 *        Parameters: (1) {jQuery.Event}
 *                    (2) {String} Entity id
 *
 * @dependency jquery.eachchange
 * @dependency jquery.ui.suggester
 * @dependency jquery.ui.resizable
 */
( function( $, undefined ) {
	'use strict';


	$.widget( 'ui.entityselector', $.ui.suggester, {

		/**
		 * Options
		 * @type {Object}
		 */
		options: {
			url: null,
			language: null,
			type: 'item',
			limit: null,
			maxItems: 10,
			selectOnAutocomplete: false,
			handles: 'e',
			timeout: 8000,
			messages: {
				'aliases-label': 'also known as:'
			}
		},

		/**
		 * Caching the most current entity returned from the API.
		 * @type {Object}
		 */
		_selectedEntity: null,

		/**
		 * Caching search term.
		 * @type {String}
		 */
		_term: null,

		/**
		 * Caching the offset of the result set's last fetched portion.
		 * @type {Number}
		 */
		_offset: 0,

		/**
		 * Hidden input element that will hold the actual entity id.
		 * @type {jQuery}
		 */
		$hiddenInput: null,

		/**
		 * @see ui.suggester._create
		 */
		_create: function() {
			if ( this.options.url === null ) {
				throw new Error( 'ui.entityselector requires url parameter to be specified.' );
			} else if ( this.options.language === null ) {
				throw new Error( 'ui.entityselector requires language parameter to be specified.' );
			}

			$.ui.suggester.prototype._create.call( this );

			this.element.addClass( 'ui-entityselector-input' );
			this.menu.element.addClass( 'ui-entityselector-list' );

			// init hidden input field that shall transmit the entity id
			this._hiddenInput( '' );

			var self = this;

			if ( typeof mw !== 'undefined' ) {
				$.each( this.options.messages, function( key, message ) {
					self.options.messages[ key ] = self._getMessage( key );
				} );
			}

			this.element
			.eachchange( function( event, oldVal ) {
				self._updateValue();
			} )
			.on( 'keydown.' + this.widgetName, function( event ) {
				// when pressing enter, check if the current input matches any of the suggested item
				// and select it
				if ( event.keyCode === $.ui.keyCode.ENTER ) {
					if ( self.validateInput() ) {
						self.menu.select( $.Event( 'programmatic' ) );
					}
					self.element.val( self.element.val() ); // reset text selection
				}
			} )
			.on( 'blur.' + this.widgetName, function( event ) {
				if ( self.validateInput() ) {
					self._trigger(
						'select',
						0,
						{ item: self.menu.active.data( 'item.autocomplete' ) }
					);
				}
			} );

			// Setting the entity on "mousedown" event. Autocmplete's native "selected" event
			// triggered on click event will manage further operations like replacing the input
			// value but "blur" event will not trigger a redundant "selected" event since the entity
			// is set already.
			this.menu.element.on ( 'mousedown.' + this.widgetName, function( event ) {
				if ( $( event.target ).closest( '.ui-menu-item' ).length ) {
					self._setEntity( $( event.target ).closest( '.ui-menu-item' ).data( 'item.autocomplete' ) );
				}
			} );

			// When focusing a menu item, replace the input value with entity id if the entity has
			// no label.
			var fnNativeMenuFocus = this.menu.option( 'focus' );
			this.menu.option( 'focus', function( event, ui ) {
				fnNativeMenuFocus( event, ui );

				var item = ui.item.data( 'item.autocomplete' );
				if ( !item.value && /^(mouse|key)/.test( event.originalEvent.type ) ) {
					self.element.val( ui.item.data( 'item.autocomplete' ).id );
				}

				self._setEntity( item );
			} );

			// Prevent native menu selected callback to alter the input value when the "selected"
			// event is triggered programmatically from inside the entity selector.
			var fnNativeMenuSelected = this.menu.option( 'selected' );
			this.menu.option( 'selected', function( event, ui ) {
				var value = self.element.val(),
					item = ui.item.data( 'item.autocomplete' );

				fnNativeMenuSelected( event, ui );

				// Reset the input value when the event has been triggered programmatically
				// (e.g. replace the input value with the entity's id when matching on an alias)
				if ( event.originalEvent.type !== 'programmatic' ) {
					self.element.val( item.value || item.id );
				} else {
					self.element.val( value );
				}

				self._setEntity( item );
			} );

			$( this ).on( 'entityselectorresponse.' + this.widgetName, function( event, response ) {
				self._offset = response.moreoffset;
			} );
		},

		/**
		 * @see ui.suggester.destroy
		 */
		destroy: function() {
			this.menu.element.off( '.' + this.widgetName );

			this.element.off( '.' + this.widgetName );
			this.element.off( 'eachchange' );

			this.element.removeClass( 'ui-entityselector-input' );

			if( this.$hiddenInput ) {
				this.$hiddenInput.remove();
				this.$hiddenInput = null;
			}
			this._term = null;
			this._offest = 0;
			$.ui.suggester.prototype.destroy.call( this );
		},

		/**
		 * Returns the message that is assigned to the given key.
		 * When mediawiki and wikibase are defined, it will be tried to fetch the message via the
		 * messaging system. First, by prefixing the key with 'wikibase-', second without prefix.
		 * If no message could be found via the messaging system, the default message specified in
		 * the entity selector's options will be returned.
		 *
		 * @param {String} key
		 * @return {String} Message
		 */
		_getMessage: function( key ) {
			if ( typeof wb !== 'undefined' && mw.messages.get( 'wikibase-' + key ) ) {
				return mw.msg( 'wikibase-' + key );
			} else if ( typeof mw !== 'undefined' && mw.messages.get( key ) ) {
				return mw.msg( key );
			} else {
				return this.options.messages[key];
			}
		},

		/**
		 * Sets/gets the value of the hidden input element which will contain the selected entity's
		 * id.
		 *
		 * @param {String} [value]
		 * @return {String} Current value
		 */
		_hiddenInput: function( value ) {
			if ( this.$hiddenInput === null ) {
				this.$hiddenInput = $( '<input/>', {
					type: 'hidden',
					name: this.element.attr( 'name' )
				} ).insertAfter( this.element );
				this.element.removeAttr( 'name' );
			}
			if ( value !== undefined ) {
				this.$hiddenInput.val( value );
			}
			return this.$hiddenInput.val();
		},

		/**
		 * @see ui.suggester._request
		 */
		_request: function( request, suggest ) {
			this._term = request.term;
			$.extend( this.options.ajax, {
				url: this.options.url,
				timeout: this.options.timeout,
				params: {
					action: 'wbsearchentities',
					format: 'json',
					language: this.options.language,
					type: this.options.type
				}
			} );
			if ( this.options.limit !== null ) {
				this.options.ajax.params.limit = this.options.limit;
			}
			$.ui.suggester.prototype._request.apply( this, arguments );
		},

		/**
		 * @see ui.suggester._success
		 */
		_success: function( response ) {
			// check if response has all information
			if ( response.success !== undefined ) {
				var suggest = this._response(),
					searchTerm = response.searchinfo.search;

				if ( searchTerm === this.element.val() ) {
					for ( var i in response.search ) {
						// If the entity has no label, the search match has to be on an alias. In
						// that case, do not set the value at all to not interfere with external
						// methods detecting if the entity has a label.
						if ( response.search[i].label ) {
							response.search[i].value = response.search[i].label;
						}
					}

					suggest( response.search ); // pass array of returned values to callback

					this._updateValue();

					// auto-complete input box text (because of the API call lag, this is
					// avoided when hitting backspace, since the value would be reset too slow)
					if ( this._lastKeyDown !== 8 && response.search.length > 0 ) {
						var firstMatch = response.search[0],
							stringToAutocomplete = firstMatch.label || '';

						// Aliases array is returned only when there is a search hit on an alias.
						// If the label does not start with the search string, auto-complete the
						// alias.
						if ( firstMatch.aliases
							&& (
								!firstMatch.label // consider label not set at all
								|| firstMatch.label.toLowerCase().indexOf(
									searchTerm.toLowerCase()
								) !== 0
							)
						) {
							stringToAutocomplete = firstMatch.aliases[0];
						}

						this.autocompleteString(
							searchTerm,
							stringToAutocomplete
						);

						if (
							this.options.selectOnAutocomplete
							&& (
								!this.selectedEntity() || this.selectedEntity().id !== firstMatch.id
							)
						) {
							this._setEntity( firstMatch );
							// Not triggering event via this._updateValue() because having
							// _updateValue() call the menu's select() method will not just trigger
							// autocomplete's 'select' event, but, in addition, close the suggestion
							// menu which shall not be done when auto-completing the input string.
							this._trigger(
								'select',
								$.Event( 'programmatic' ),
								{ item: firstMatch }
							);
						}
					}

					this.menu.element.children( 'li' ).first().addClass( 'first' );
					this._trigger( 'response', 0, [response.search] );
				} else {
					// suggest nothing when the response does not match with the current input value
					// informing autocomplete that there is one less pending request
					suggest();
				}
			}
		},

		/**
		 * Checks whether the value specified in the input box matches the first suggested item.
		 * If not, the user changed the input value after selecting an item, so the actual value
		 * needs to be reset.
		 *
		 * @return {Boolean} Whether the value has been updated or not.
		 */
		_updateValue: function() {
			var items = this.menu.element.children( 'li' );
			if ( items.length > 0 ) {
				var firstItem = items.first().data( 'item.autocomplete' ),
					currentValue = this.element.val();
				if (
					currentValue === firstItem.label
					||
					( firstItem.aliases && currentValue === firstItem.aliases[0] )
				) {
					this.menu.activate( $.Event( 'programmatic' ), items.first() );
					this._setEntity( firstItem );
					this.menu.select( $.Event( 'programmatic' ) );
					// prevent hiding the menu if there is more than one suggestion remaining or the
					// last remaining suggestion has not been fully specified yet
					if (
						items.length > 1
						|| (
							currentValue !== firstItem.label
							&& currentValue !== firstItem.aliases[0]
						)
					) {
						this.menu.element.show();
					}
				} else {
					this._hiddenInput( '' );
					this._setEntity( null );
				}
				return true;
			}
			return false;
		},

		/**
		 * @see ui.autocomplete._resizeMenu
		 */
		_resizeMenu: function() {
			// the menu is rebuilt completely; therefore, jquery.ui.resizable has to be re-inited
			if ( this.menu.element.data( 'resizable' ) !== undefined ) {
				this.menu.element.data( 'resizable' ).destroy();
			}
			this.menu.element.resizable( { handles: this.options.handles } );
			$.ui.suggester.prototype._resizeMenu.call( this );
		},

		/**
		 * @see ui.autocomplete._renderItem
		 */
		_renderItem: function( ul, item ) {
			/* wrap all text in <a> tags using common jquery.menu style */
			var section =
				$( '<li/>' ).data( 'item.autocomplete', item )
				.append(
					$( '<a/>' ).addClass( 'ui-entityselector-section-container' ).append(
						$( '<span/>' ).addClass( 'ui-entityselector-itemcontent' )
						.append(
							$( '<span/>' ).addClass( 'ui-entityselector-label' ).text( item.label )
						)
					)
				);

			if ( item.description !== undefined ) {
				section.find( '.ui-entityselector-itemcontent' ).append(
					$( '<span/>' ).addClass( 'ui-entityselector-description' )
					.text( item.description )
				);
			}

			if ( item.aliases ) {
				section.find( '.ui-entityselector-itemcontent' ).append(
					$( '<span/>' ).addClass( 'ui-entityselector-aliases' )
					.text(
						this.options.messages[ 'aliases-label' ] + ' ' + item.aliases.join( ', ' )
					)
				);
			}

			return section.appendTo( ul );
		},

		/**
		 * Prevent highlighting of characters.
		 *
		 * @see ui.suggester._highlightMatchingCharacters
		 */
		_highlightMatchingCharacters: function() {},

		/**
		 * Tries to select an entity according to the input box value.
		 *
		 * @return {Boolean} Whether current input value could be matched to an entity label that is
		 *         not selected already
		 */
		validateInput: function() {
			var self = this,
				found = false,
				alreadySelected = false,
				fallbackListItem = false;
			$.each( this.menu.element.children( 'li' ), function( i, listItem ) {
				var item = $( listItem ).data( 'item.autocomplete' );
				if (
					self.element.val() === item.label
					|| item.aliases && self.element.val() === item.aliases[0]
					|| self.element.val() === item.id // displaying the id if entity has no label
				) {
					// no need to trigger selecting again since the item id is selected already
					if ( self.selectedEntity() !== null && item.id === self.selectedEntity().id ) {
						alreadySelected = true;
						return false;
					// set a fallback item to select by matching the text
					} else if ( !fallbackListItem ) {
						fallbackListItem = listItem;
					}
				}
			} );

			// If there is no suggested item that covers the exact input value and whose id is
			// selected already, select the fallback item which is the first item in the suggestion
			// list that matches the input value.
			if ( !alreadySelected && fallbackListItem ) {
				self._setEntity( $( fallbackListItem ).data( 'item.autocomplete' ) );
				self.menu.activate( $.Event( 'programmatic' ), $( fallbackListItem ).first() );
				found = true;
			}

			if ( !found && !alreadySelected ) {
				this._setEntity( null );
			}
			return found;
		},

		/**
		 * Sets the currently selected entity.
		 *
		 * @param {Object|null} entity Entity data or null to reset the currently selected entity
		 */
		_setEntity: function( entity ) {
			if ( entity === null ) {
				this._hiddenInput( '' );
				this._selectedEntity = null;
			} else {
				this._hiddenInput( entity.id );
				this._selectedEntity = {
					id: entity.id,
					label: entity.label || null
				};
			}
		},

		/**
		 * Sets/gets the currently selected entity updating the displayed value.
		 *
		 * @param {String|Object|null} [entity] Object containing entity data (entity's ID as 'id'
		 *        and its label as 'label') or a plain entity id. If set to null, the currently set
		 *        entity will be unset.
		 * @return {Object} entityData
		 */
		selectedEntity: function( entity ) {
			var self = this;

			/**
			 * Sets the entity and updated the input element's value.
			 *
			 * @param {Object|null} entity
			 */
			var setEntity = function( entity ) {
				// use entity id as label if the entity has no label.
				// label field might be undefined/null/false/empty string!
				var label = entity ? ( entity.label || entity.id ) : '';

				self._setEntity( entity );
				self.element.val( label );

				self._trigger( 'aftersetentity', 0, [ entity ? entity.id : null ] );
			};

			if ( entity === undefined ) {
				entity = this._selectedEntity;
			} else if ( entity === null ) {
				setEntity( null );
			} else if ( typeof entity === 'object' ) {
				if( !entity.id ) {
					throw new Error( 'entity selector: Tried to set an entity missing an id.' );
				}
				setEntity( entity );
			} else if ( typeof entity === 'string' ) {
				var entityId = entity;

				// fetch the entity's label from the API
				var params = {
					action: 'wbgetentities',
					ids: entityId,
					props: 'labels',
					languages: this.options.language,
					format: 'json'
				};

				// While waiting for the API response, do not disable the input element but set it
				// to read-only to still allow focus to be applied to the element.
				this.element.prop( 'readonly', true );

				$.ajax( {
					url: this.options.url,
					data: params,
					timeout: this.options.timeout,
					dataType: 'json'
				} )
				.always( function() {
					self.element.prop( 'readonly', false );
				} )
				.fail( function ( xhr, textStatus, exception ) {
					throw new Error( 'entity selector: API request failed: ' + textStatus );
				} )
				.done( function ( result ) {
					var label = false;

					if ( result.error ) {
						throw new Error( 'entity selector: API returned error: '
							+ result.error.info + ' (' + result.error.code + ')' );
					} else {
						if ( result.entities[entityId].labels !== undefined ) {
							// the entity has a label in the language the entity selector has been
							// initialised with
							label = result.entities[entityId].labels[self.options.language].value;
						}
					}

					setEntity( { id: entityId, label: label } );
				} );
			}
			return entity;
		}

	} );

}( jQuery ) );
