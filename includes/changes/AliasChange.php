<?php

namespace Wikibase;

/**
 * Class representing a single change to an item affecting one or more sitelinks.
 *
 * @since 0.1
 *
 * @file
 * @ingroup WikibaseLib
 *
 * @licence GNU GPL v2+
 * @author Jeroen De Dauw < jeroendedauw@gmail.com >
 */
class AliasChange extends MapChange {

	/**
	 * Returns the type of change.
	 *
	 * @since 0.1
	 *
	 * @return string
	 */
	public function getType() {
		return 'alias';
	}

}