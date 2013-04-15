<?php

namespace Wikibase;

use Site;

/**
 * Index for tracking the usage of entities on a specific client wiki.
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
 *
 *
 * @author Daniel Kinzler
 */
class EntityUsageIndex {

	/**
	 * @param Site           $clientSite
	 * @param SiteLinkLookup $siteLinks
	 */
	public function __construct( Site $clientSite, SiteLinkLookup $siteLinks ) {
		$this->clientSite = $clientSite;
		$this->siteLinks = $siteLinks;
	}

	/**
	 * Returns the Site of the client wiki this usage index is tracking.
	 *
	 * @since    0.4
	 *
	 * @return Site
	 */
	public function getClientSite() {
		return $this->clientSite;
	}

	/**
	 * Determines which pages use any of the given entities.
	 *
	 * @since    0.4
	 *
	 * @param EntityId[] $entities
	 *
	 * @return String[] list of pages using any of the given entities
	 */
	public function getEntityUsage( array $entities ) {
		if ( empty( $entities ) ) {
			return array();
		}

		$ids = array_map(
			function ( EntityId $id ) {
				return $id->getNumericId();
			},
			$entities
		);

		$rows = $this->siteLinks->getLinks( $ids, array( $this->clientSite->getGlobalId() ) ) ;

		$pages = array_map(
			function ( array $row ) {
				return $row[1]; // page name
			},
			$rows
		);

		$pages = array_unique( $pages );
		return $pages;
	}

	/**
	 * Checks which of the given entities is used on the target wiki,
	 * and removed all others.
	 *
	 * @since    0.4
	 *
	 * @param EntityID[]  $entities The entities to check
	 * @param string|null $type     The entity type to check. This is an optional hint that may
	 *                              be used for optimization. If given, all IDs in the $entities
	 *                              array must refer to entities of the given type.
	 *
	 * @return EntityID[] the entities actually used on the target wiki
	 * @throws \MWException if $type is set and one of the ids in $entities
	 */
	public function filterUnusedEntities( array $entities, $type = null ) {
		if ( empty( $entities ) ) {
			return array();
		}

		if ( $type !== null && $type !== Item::ENTITY_TYPE ) {
			return array();
		}

		$ids = array_map(
			function ( EntityId $id ) use ( $type ) {
				if ( $type !== null && $id->getEntityType() !== $type ) {
					throw new \MWException( "Optimizing for $type, encountered ID for " . $id->getEntityType() );
				}

				return $id->getNumericId();
			},
			$entities
		);

		//todo: pass the type hint to the SiteLinksLookup, to allow for more efficient queries
		$rows = $this->siteLinks->getLinks( $ids, array( $this->clientSite->getGlobalId() ) ) ;

		$used = array_map(
			function ( array $row ) {
				return intval($row[2]); // item id
			},
			$rows
		);

		$used = array_flip( $used );

		$filtered = array_filter(
			$entities,
			function ( EntityId $id ) use ( $used ) {
				return array_key_exists( $id->getNumericId(), $used );
			}
		);

		return $filtered;

	}

	/**
	 * Determines which entities are used by any of the given pages.
	 *
	 * The page titles must be strings in the canonical form, as returned
	 * by Title::getPrefixedText() on the target wiki. Note that it is not
	 * reliable to use Title objects locally to represent pages on another wiki,
	 * since namespaces and normalization rules may differ.
	 *
	 * @since 0.4
	 *
	 * @param string[] $pages The titles of the pages to check.
	 *
	 * @return EntityID[] The entities used.
	 */
	public function getUsedEntities( array $pages ) {
		if ( empty( $pages ) ) {
			return array();
		}

		$entities = array();

		//todo: implement batched lookup in SiteLinkLookup
		foreach ( $pages as $page ) {
			$id = $this->siteLinks->getItemIdForLink( $this->clientSite->getGlobalId(), $page );

			if ( $id !== false ) {
				//Note: we are using the numeric ID as the key here to make sure each item only
				//      shows up once. If we had other entity types too, we'd need to use the
				//      prefixed ID.
				$entities[$id] = new EntityId( Item::ENTITY_TYPE, $id );
			}
		}

		return $entities;
	}
}
