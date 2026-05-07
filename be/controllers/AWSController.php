<?php
use Aws\S3\S3Client;
use Aws\Exception\AwsException;
class AWSController{
    /**
     * Returns a JSON string object to the browser when hitting the root of the domain
     *
     * @url POST /img
     */
    public function img_handler($data){
        
        if( !verify_nonce($data->nonce, $_ENV['NONCE_ACTION']) ){
            http_response_code(403);
            return ['result' => 'error', 'message' => 'Invalid request'];
        }

        $dataUrl = $data->imageData;

        // Decode the dataUrl to obtain the image data
        $imageData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $dataUrl));

        // Save the image data to a temporary file
        $tempFile = tmpfile();
        fwrite($tempFile, $imageData);
        rewind($tempFile);
        $metaData = stream_get_meta_data($tempFile);
        $tempFilePath = $metaData['uri'];

        // Configure AWS S3 client
        $s3 = new S3Client([
            'version' => 'latest',
            'region'  => $_ENV['AWS_REGION'] ?? 'us-west-2',
            'credentials' => [
                'key' => $_ENV['AWS_ACCESS_KEY_ID'],
                'secret' => $_ENV['AWS_SECRET_ACCESS_KEY'],
            ],
        ]);

        // Upload the image to S3.
        // If the request's Referer matches a whitelisted artist domain, prefix
        // the S3 key with that domain's slug. The slug rides along inside the
        // returned URL through the redirect → frontend → /lob flow, so
        // LobController can later recover a server-verified embed origin
        // without trusting the request body.
        $bucket = $_ENV['AWS_BUCKET'] ?? 'cc0-postcard-bucket';
        $referer_origin = origin_from_url($_SERVER['HTTP_REFERER'] ?? '');
        $matched_domain = null;
        if ($referer_origin) {
            global $domain_template_map;
            foreach ($domain_template_map as $entry) {
                if ($entry->url === $referer_origin) {
                    $matched_domain = $entry->domain;
                    break;
                }
            }
        }
        $random = bin2hex(random_bytes(16));
        $key = $matched_domain
            ? slug_for_domain($matched_domain) . '--' . $random . '.jpg'
            : $random . '.jpg';

        try {
            $result = $s3->putObject([
                'Bucket' => $bucket,
                'Key'    => $key,
                'SourceFile' => $tempFilePath,
                'ContentType' => 'image/jpeg',
            ]);

            // Return the result to the client
            return ['result' => 'success', 'url' => $result['ObjectURL']];
        } catch (AwsException $e) {
            // Log the error in development only
            if ($_ENV['APP_ENV'] === 'development') {
                error_log('AWS S3 Error: ' . $e->getMessage());
            }
            http_response_code(500);
            return ['result' => 'error', 'message' => 'Failed to upload image'];
        } finally {
            // Close and delete the temporary file
            fclose($tempFile);
        }
    }
}
