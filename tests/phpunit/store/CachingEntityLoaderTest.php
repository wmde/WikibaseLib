<?php

namespace Wikibase\Test;
use Wikibase\CachingEntityLoader;
use Wikibase\Item;
use Wikibase\Query;
use Wikibase\EntityLookup;
use Wikibase\EntityId;
use Wikibase\Property;

/**
 * Tests for the Wikibase\EntityLoader class.
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
 * @ingroup Test
 *
 * @group WikibaseLib
 * @group WikibaseEntityLookup
 *
 * @licence GNU GPL v2+
 * @author Daniel Kinzler
 *
 * @todo: turn this into a base class for tests for different EntityLookup tests
 */
class CachingEntityLoaderTest extends EntityLookupTest {

	/**
	 * @see EntityLookupTest::newEntityLoader()
	 *
	 * @return EntityLookup
	 */
	protected function newEntityLoader( array $entities ) {
		$mock = new MockRepository();

		foreach ( $entities as $entity ) {
			$mock->putEntity( $entity );
		}

		return new CachingEntityLoader( $mock );
	}

}

