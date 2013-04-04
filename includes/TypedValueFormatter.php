<?php

namespace Wikibase\Lib;

use DataTypes\DataType;
use DataValues\DataValue;
use ValueFormatters\ValueFormatter;

/**
 * Provides a string representation for a DataValue given its associated DataType.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 * http://www.gnu.org/copyleft/gpl.html
 *
 * @since 0.4
 *
 * @file
 * @ingroup WikibaseLib
 *
 * @licence GNU GPL v2+
 * @author Jeroen De Dauw < jeroendedauw@gmail.com >
 */
class TypedValueFormatter {

	public function formatToString( DataValue $dataValue, DataType $dataType ) {
		// TODO: update this code to obtain the string formatter as soon as corresponding changes
		// in the DataTypes library have been made.

		$valueFormatters = $dataType->getFormatters();
		$valueFormatter = reset( $valueFormatters );

		// FIXME: before we can properly use the DataType system some issues to its implementation need
		// to be solved. Once this is done, this evil if block and function it calls should go.
		if ( $valueFormatter === false && $dataType->getId() === 'wikibase-item' ) {
			$valueFormatter = $this->evilGetEntityIdFormatter();
		}

		if ( $valueFormatter === false ) {
			$value = $dataValue->getValue();

			if ( is_string( $value ) ) {
				return $value;
			}

			// TODO: implement: error message or other error handling
			return 'ERROR: TODO: getValue returned non-string, so DataType is missing formatter';
		}

		/**
		 * @var ValueFormatter $valueFormatter
		 */
		$formattingResult = $valueFormatter->format( $dataValue );

		if ( $formattingResult->isValid() ) {
			return $formattingResult->getValue();
		}

		// TODO: implement: error message or other error handling
		return 'ERROR: TODO: formatting failed';
	}

	private function evilGetEntityIdFormatter() {
		$entityLookup = new \Wikibase\CachingEntityLoader( new \Wikibase\WikiPageEntityLookup( \Wikibase\Settings::get( 'repoDatabase' ) ) );

		$prefixMap = array();

		foreach ( \Wikibase\Settings::get( 'entityPrefixes' ) as $prefix => $entityType ) {
			$prefixMap[$entityType] = $prefix;
		}

		$options = new \ValueFormatters\FormatterOptions( array(
			\Wikibase\Lib\EntityIdFormatter::OPT_PREFIX_MAP => $prefixMap
		) );

		$idFormatter = new \Wikibase\Lib\EntityIdFormatter( $options );

		$options = new \ValueFormatters\FormatterOptions();

		$labelFormatter = new \Wikibase\Lib\EntityIdLabelFormatter( $options, $entityLookup );
		$labelFormatter->setIdFormatter( $idFormatter );

		return $labelFormatter;
	}

}
