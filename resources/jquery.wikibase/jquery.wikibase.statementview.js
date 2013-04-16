/**
 * @file
 * @ingroup WikibaseLib
 *
 * @licence GNU GPL v2+
 * @author Daniel Werner < daniel.werner@wikimedia.de >
 * @author H. Snater < mediawiki@snater.com >
 */
( function( mw, wb, $ ) {
	'use strict';

	var PARENT = $.wikibase.claimview;

/**
 * View for displaying and editing Wikibase Statements.
 *
 * @since 0.4
 * @extends jQuery.wikibase.claimview
 */
$.widget( 'wikibase.statementview', PARENT, {
	widgetBaseClass: 'wb-statementview',

	options: {
		template: 'wb-statement',
		templateParams: [
			'wb-last', // class: wb-first|wb-last
			function() { // class='wb-claim-$2'
				return ( this._claim && this._claim.getGuid() ) || 'new';
			},
			'', // TODO: This toolbar placeholder should be removed from the template.
			'', // .wb-claim-mainsnak
			'', // Qualifiers
			'', // Rreferences heading
			'' // List of references
		],
		templateShortCuts: {
			'$mainSnak': '.wb-claim-mainsnak',
			'$qualifiers': '.wb-statement-qualifiers',
			'$refsHeading': '.wb-statement-references-heading',
			'$references': '.wb-statement-references'
		}
	},

	/**
	 * Shortcut to the list item adapter in use in the reference view.
	 * @type {jquery.wikibase.listview.ListItemAdapter}
	 */
	_referenceviewLia: null,

	/**
	 * @see jQuery.claimview._create
	 */
	_create: function() {
		// add claimview class as well, so we inherit basic CSS rules:
		this.element.addClass( 'wb-claimview' );

		PARENT.prototype._create.call( this );

		var self = this,
			statement = this.value(),
			refs = statement ? statement.getReferences() : [];

		if( this.value() ) {
			var $listview = $( '<div/>' )
			.prependTo( this.$references )
			.listview( {
				listItemAdapter: new $.wikibase.listview.ListItemAdapter( {
					listItemWidget: $.wikibase.referenceview,
					listItemWidgetValueAccessor: 'value',
					newItemOptionsFn: function( value ) {
						return {
							value: value || null,
							statementGuid: self.value().getGuid()
						};
					}
				} ),
				value: refs
			} );

			this._referenceviewLia = $listview.data( 'listview' ).listItemAdapter();

			$listview
			.on( this._referenceviewLia.prefixedEvent( 'remove' ), function( event ) {
				var liInstance = self._referenceviewLia.liInstance( $( event.target) );

				liInstance.disable();

				self._removeReferenceApiCall( liInstance.value() )
				.done( function( pageInfo ) {
						liInstance._trigger( 'afterremove' );
				} ).fail( function( errorCode, details ) {
					var error = wb.RepoApiError.newFromApiResponse( errorCode, details, 'remove' );

					liInstance.enable();
					liInstance.element.addClass( 'wb-error' );

					liInstance._trigger( 'toggleError', null, [ error ] );
				} );
			} )
			.on( 'listviewitemadded listviewitemremoved', function( event, value, $li ) {
				if ( $listview[0] === event.target ) {
					self.drawReferencesCounter();
				}
			} )
			.on( 'listviewitemadded', function( event, value, $newLi ) {
				// Only listen to the listview filled with references. There are other descendant
				// listview widgets whose events we do not want to listen to.
				if ( $listview[0] === event.target ) {

					var lia = self._referenceviewLia,
						liInstance = lia.liInstance( $newLi );

					if ( !liInstance.value() ) {
						$newLi
						.on( lia.prefixedEvent( 'afterstopediting' ), function( event, dropValue ) {
							if( dropValue ) {
								liInstance.destroy();
								$newLi.remove();
								self.drawReferencesCounter();
							} else {
								var newReferenceWithHash = liInstance.value();

								// Destroy new reference input form and add reference to list
								liInstance.destroy();
								$newLi.remove();

								// Display new reference with final GUID
								self._addReference( newReferenceWithHash );
							}
						} );
					}
				}
			} )
			.on( 'listviewenternewitem', function( event, $newLi ) {
				// Enter first item into the referenceview.
				self._referenceviewLia.liInstance( $newLi ).enterNewItem();
			} );

			// Forward query for listview reference.
			this.$references.data(
				'listview',
				this.$references.children( '.wb-listview' ).data( 'listview' )
			);

			// Collapse references if there is at least one.
			if ( this.$references.data( 'listview' ).items().length > 0 ) {
				this.$references.css( 'display', 'none' );
			}

			// toggle for references section:
			var $toggle = wb.utilities.ui.buildToggle(
				mw.msg( // will be overwritten by drawReferencesCounter() immediately!
					'wikibase-statementview-referencesheading-pendingcountersubject',
					refs.length ),
				this.$references
			);
			this.$refsHeading.append( $toggle );

			// replace heading with nice counter:
			this.drawReferencesCounter();
		} else {
			this.element.addClass( this.widgetBaseClass + '-new' );
		}
	},

	/**
	 * Instantiates a statement with the statementview's current value.
	 * @see jQuery.wikibase.claimview._instantiateClaim
	 *
	 * @param {string} guid
	 * @return {wb.Statement}
	 */
	_instantiateClaim: function( guid ) {
		return new wb.Statement(
			this.$mainSnak.data( 'snakview' ).snak(),
			( this._qualifiers ) ? this._qualifiers.value() : null,
			this.getReferences(),
			null, // TODO: Rank
			guid
		);
	},

	/**
	 * Adds one reference to the list and renders it in the view.
	 * @since 0.4
	 *
	 * @param {wb.Reference} reference
	 */
	_addReference: function( reference ) {
		var lv = this.$references.children( '.wb-listview' ).data( 'listview' );
		lv.addItem( reference );
	},

	/**
	 * Returns all references currently set (including all pending changes).
	 *
	 * @return {wb.Reference[]}
	 */
	getReferences: function() {
		var self = this,
			references = [];

		// If the statement is pending (not yet stored), the listview widget for the references is
		// not defined.
		if ( !this.$references.data( 'listview' ) ) {
			return references;
		}

		$.each( this.$references.data( 'listview' ).items(), function( i, item ) {
			var referenceview = self._referenceviewLia.liInstance( $( item ) );
			references.push( referenceview.value() );
		} );

		return references;
	},

	/**
	 * Triggers the API call to remove a reference.
	 * @since 0.4
	 *
	 * @param {wb.Reference} reference
	 * @return {jQuery.Promise}
	 */
	_removeReferenceApiCall: function( reference ) {
		var api = new wb.RepoApi(),
			guid = this.value().getGuid();

		return api.removeReferences(
			guid,
			reference.getHash(),
			wb.getRevisionStore().getClaimRevision( guid )
		).done( function( baseRevId ) {
			// update revision store
			wb.getRevisionStore().setClaimRevision( baseRevId, guid );
		} );
	},

	/**
	 * @see $.widget.destroy
	 */
	destroy: function() {
		this.element.removeClass( this.widgetBaseClass + '-new' );
		this.element.removeClass( 'wb-claimview' );
		PARENT.prototype.destroy.call( this );
	},

	/**
	 * Returns the current Statement represented by the view. If null is returned, than this is a
	 * fresh view where a new Statement is being constructed.
	 *
	 * @since 0.4
	 *
	 * @return {wb.Statement|null}
	 */
	value: function() {
		var claim = this._claim;

		if( !claim ) {
			return null;
		}
		if( !( claim instanceof wb.Statement ) ) {
			return new wb.Statement( claim.getMainSnak(), null, [], 0, claim.getGuid() );
		}
		return claim;
	},

	/**
	 * Will update the references counter in the DOM.
	 *
	 * @since 0.4
	 */
	drawReferencesCounter: function() {
		var listView = this.$references.data( 'listview' ),
			numberOfValues = listView.nonEmptyItems().length,
			numberOfPendingValues = listView.items().length - numberOfValues;

		// build a nice counter, displaying fixed and pending values:
		var $counterMsg = wb.utilities.ui.buildPendingCounter(
			numberOfValues,
			numberOfPendingValues,
			'wikibase-statementview-referencesheading-pendingcountersubject',
			'wikibase-statementview-referencesheading-pendingcountertooltip' );

		// update counter, don't touch the toggle!
		this.$refsHeading.find( '.wb-toggle-label' ).empty().append( $counterMsg );
	}
} );

// Register toolbars:
$.wikibase.toolbarcontroller.definition( 'edittoolbar', {
	widgetName: 'wikibase.statementview',
	events: {
		statementviewchange: function( event ) {
			var $target = $( event.target ),
				statementview = $target.data( 'statementview' ),
				enable = statementview.isValid() && !statementview.isInitialValue(),
				edittoolbar = $target.data( 'edittoolbar' );

			if ( statementview._qualifiers && (
				!statementview._qualifiers.isValid()
				|| statementview._qualifiers.isInitialValue() && statementview.isInitialValue()
			) ) {
				enable = false
			}

			edittoolbar.toolbar.editGroup.btnSave[ enable ? 'enable' : 'disable' ]();
		}
	},
	options: {
		interactionWidgetName: $.wikibase.statementview.prototype.widgetName,
		toolbarParentSelector: '.wb-statement-claim'
	}
} );

$.wikibase.toolbarcontroller.definition( 'addtoolbar', {
	id: 'references',
	selector: '.wb-statement-references-container',
	eventPrefix: 'listview',
	baseClass: 'wb-snaklistview-listview',
	options: {
		toolbarParentSelector: '.wb-statement-references',
		customAction: function( event, $parent ) {
			var statementView = $parent.closest( '.wb-statementview' ).data( 'statementview' ),
				listview = statementView.$references.data( 'listview' );
			listview.enterNewItem();
		},
		eventPrefix: $.wikibase.statementview.prototype.widgetEventPrefix,
		addButtonLabel: mw.msg( 'wikibase-addreference' )
	}
} );

}( mediaWiki, wikibase, jQuery ) );
