<?php

namespace Wikibase\Test;
use Wikibase\LibHooks;

/**
 * Tests for the Wikibase\LibHooks class.
 *
 * @file
 * @since 0.1
 *
 * @ingroup WikibaseLib
 * @ingroup Test
 *
 * @group Wikibase
 * @group WikibaseLib
 *
 * @licence GNU GPL v2+
 * @author Jeroen De Dauw < jeroendedauw@gmail.com >
 */
class LibHooksTest extends \MediaWikiTestCase {

	public function testRegisterPhpUnitTests() {
		$files = array();

		$this->assertTrue( LibHooks::registerPhpUnitTests( $files ) );

		$this->assertTrue( count( $files ) > 0 );
	}

}