/**
 * @file
 * @ingroup WikibaseLib
 * @licence GNU GPL v2+
 * @author Daniel Werner
 */
( function( wb, dv, $, undefined ) {
'use strict';

/**
 * Represents a Wikibase Snak in JavaScript.
 * @constructor
 * @abstract
 * @since 0.2
 * @see https://meta.wikimedia.org/wiki/Wikidata/Data_model#Snaks
 *
 * @param {String} propertyId
 */
wb.Snak = function( propertyId ) {
	// check whether the Snak has a type, doesn't make sense to create an instance of wb.Snak!
	if( !this.constructor.TYPE ) {
		throw new Error( 'Can not create abstract Snak of no specific type' );
	}
	if( !propertyId ) {
		throw new Error( 'Property ID is required for constructing new Snak' );
	}
	this._propertyId = propertyId;
};

/**
 * String to identify this type of Snak
 * @since 0.3
 * @type String
 */
wb.Snak.TYPE = null;

wb.Snak.prototype = {
	/**
	 * @type Number
	 */
	_propertyId: null,

	/**
	 * Returns what type of Snak this is.
	 * @since 0.3

	 * @return String
	 */
	getType: function() {
		return this.constructor.TYPE;
	},

	/**
	 * Returns the ID of the property entity the Snak relates to.
	 * @return Number
	 */
	getPropertyId: function() {
		return this._propertyId;
	},

	/**
	 * Returns whether this Snak is equal to another Snak. This means that their property and type
	 * are the same, as well as any other attributes they might have depending on their Snak type.
	 *
	 * @param {wb.Snak} snak
	 * @return {Boolean}
	 */
	equals: function( snak ) {
		return snak === this
			|| (
				this.getPropertyId() === snak.getPropertyId()
				&& this.getType() === snak.getType()
			);
	},

	/**
	 * Returns a simple JSON structure representing this data value.
	 * @since 0.3
	 *
	 * @return Object
	 */
	toJSON: function() {
		return {
			snaktype: this.getType(),
			property: this.getPropertyId()
		};
	}
};

/**
 * Creates a new Snak object from a given JSON structure.
 *
 * @param {String} json
 * @return {wb.Snak}
 */
wb.Snak.newFromJSON = function( json ) {
	switch( json.snaktype ) {
		case 'value':
			var dataValue = dv.newDataValue(
				json.datavalue.type,
				json.datavalue.value
			);
			return new wb.PropertyValueSnak( json.property, dataValue );
		case 'novalue':
			return new wb.PropertyNoValueSnak( json.property );
		case 'somevalue':
			return new wb.PropertySomeValueSnak( json.property );
		default:
			return null;
	}
};

}( wikibase, dataValues, jQuery ) );
