<?php

namespace Wikibase;

/**
 * Allows storing and accessing of templates (e.g. snippets commonly used in server-side HTML
 * generation and client-side JavaScript processing).
 *
 * This class Represents a template that can contain placeholders just like MediaWiki messages.
 *
 * @since 0.2
 *
 * @licence GNU GPL v2+
 * @author H. Snater <mediawiki@snater.com>
 */
class Template extends \Message {

	protected $templateRegistry;

	/**
	 * important! note that the Template class does not escape anything.
	 * be sure to escape your params before using this class!
	 *
	 * @param TemplateRegistry $templateRegistry
	 * @param $key: message key, or array of message keys to try
	 *          and use the first non-empty message for
	 * @param $params Array message parameters
	 */
	public function __construct( TemplateRegistry $templateRegistry, $key, $params = array() ) {
		$this->templateRegistry = $templateRegistry;
		parent::__construct( $key, $params );
	}

	/**
	 * Fetch a template from the template store.
	 * @see \Message.fetchMessage()
	 *
	 * @return string template
	 */
	protected function fetchMessage() {
		if ( !isset( $this->message ) ) {
			$this->message = $this->templateRegistry->getTemplate( $this->key );
		}
		return $this->message;
	}

	/**
	 * @return string
	 */
	public function render() {
		// Use plain() to prevent replacing {{...}}:
		return $this->plain();
	}

}
