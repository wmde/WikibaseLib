/**
 * @licence GNU GPL v2+
 * @author H. Snater < mediawiki@snater.com >
 */
( function( $ ) {
	'use strict';

	var PARENT = $.ui.TemplatedWidget;

/**
 * Encapsulates multiple sitelinkgroupview widget.
 * @since 0.5
 * @extends jQuery.TemplatedWidget
 *
 * @option {Object[]} value
 *         Array of objects representing the widget's value.
 *         Structure: [{ group: <{string}>, siteLinks: <{wikibase.datamodel.SiteLink[]}> }[, ...]]
 *
 * @options {string} entityId
 *
 * @option {wikibase.RepoApi} api
 *
 * @option {wikibase.store.EntityStore} entityStore
 */
$.widget( 'wikibase.sitelinkgrouplistview', PARENT, {
	options: {
		template: 'wikibase-sitelinkgrouplistview',
		templateParams: [
			'' // sitelinklistview(s)
		],
		templateShortCuts: {},
		value: null,
		entityId: null,
		api: null,
		entityStore: null
	},

	/**
	 * @type {jQuery}
	 */
	$listview: null,

	/**
	 * @see jQuery.ui.TemplatedWidget._create
	 */
	_create: function() {
		if( !this.options.value || !this.options.entityId || !this.options.api
			|| !this.options.entityStore ) {
			throw new Error( 'Required option(s) missing' );
		}

		PARENT.prototype._create.call( this );

		this._createListview();

		this.element.addClass( 'wikibase-sitelinkgrouplistview' );
	},

	/**
	 * @see jQuery.ui.TemplatedWidget.destroy
	 */
	destroy: function() {
		if( this.$listview ) {
			var listview = this.$listview.data( 'listview' );
			if( listview ) {
				listview.destroy();
			}
			this.$listview.remove();
			delete this.$listview;
		}
		this.element.removeClass( 'wikibase-sitelinkgrouplistview' );
		PARENT.prototype.destroy.call( this );
	},

	_createListview: function() {
		var self = this;

		this.$listview = this.element.find( '.wb-listview' );

		if( !this.$listview.length ) {
			this.$listview = $( '<div/>' ).appendTo( this.element );
		}

		this.$listview
		.listview( {
			listItemAdapter: new $.wikibase.listview.ListItemAdapter( {
				listItemWidget: $.wikibase.sitelinkgroupview,
				listItemWidgetValueAccessor: 'value',
				newItemOptionsFn: function( value ) {
					return {
						value: value,
						entityId: self.options.entityId,
						api: self.options.api,
						entityStore: self.options.entityStore
					};
				}
			} ),
			value: self.options.value || null
		} );
	}
} );

}( jQuery ) );
