<?php
error_log("AWS Controller loaded");
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
            http_response_code(500);
            return ['result' => 'error', 'message' => 'Bad nonce'];
        }

        error_log(print_r($data,true));

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
            'region'  => 'us-west-2',
            'credentials' => [
                'key' => $_ENV['AWS_KEY'],
                'secret' => $_ENV['AWS_SECRET'],
            ],
        ]);

        // Upload the image to S3
        $bucket = 'cc0-postcard-bucket';
        $key = bin2hex(random_bytes(16)) . '.jpg';

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
            // Log the error and return a response
            error_log($e->getMessage());
            http_response_code(500);
            return ['result' => 'error', 'message' => 'Failed to upload image to S3'];
        } finally {
            // Close and delete the temporary file
            fclose($tempFile);
        }
    }
}
