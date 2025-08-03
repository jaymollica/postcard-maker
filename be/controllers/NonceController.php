<?php
use \Jacwright\RestServer\RestException;

class NonceController{
    /**
     * Returns a JSON string object to the browser when hitting the root of the domain
     *
     * @url POST /nonce
     */
    public function nonce_handler($data){
        $nonce = generate_nonce($_ENV['NONCE_ACTION']);
        return array(
            'nonce' => $nonce
        );
    }
}
