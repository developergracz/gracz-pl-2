<?php

use Facebook\FacebookSession;
use Facebook\FacebookRequest;
use Facebook\GraphUser;
use Facebook\FacebookRequestException;
use Facebook\FacebookRedirectLoginHelper;
use Facebook\FacebookEntitiesAccessToken;
use Facebook\HttpClients\FacebookHttpable;
use Facebook\HttpClients\FacebookCurl;
use Facebook\HttpClients\FacebookCurlHttpClient;


/**
 * Register the autoloader for the Facebook SDK classes.
 * Based off the official PSR-4 autoloader example found here:
 * https://github.com/php-fig/fig-standards/blob/master/accepted/PSR-4-autoloader-examples.md
 *
 * @param string $class The fully-qualified class name.
 * @return void
 */
spl_autoload_register(function ($class)
{
  if (version_compare(PHP_VERSION, '5.4.0', '<')) {
    throw new Exception('The Facebook SDK v4 requires PHP version 5.4 or higher.');
  }

  // project-specific namespace prefix
  $prefix = 'Facebook\\';

  // base directory for the namespace prefix
  $base_dir = defined('FACEBOOK_SDK_V4_SRC_DIR') ? FACEBOOK_SDK_V4_SRC_DIR : __DIR__ . '/Facebook/';

  // does the class use the namespace prefix?
  $len = strlen($prefix);
  if (strncmp($prefix, $class, $len) !== 0) {
    // no, move to the next registered autoloader
    return;
  }

  // get the relative class name
  $relative_class = substr($class, $len);

  // replace the namespace prefix with the base directory, replace namespace
  // separators with directory separators in the relative class name, append
  // with .php
  $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

  // if the file exists, require it
  if (file_exists($file)) {
    require $file;
  }
});

function facebookInitAPI()
{
    global $facebook_client_id, $facebook_app_secret;

    return new Facebook\Facebook([
        'app_id' => $facebook_client_id, // Replace {app-id} with your app id
        'app_secret' => $facebook_app_secret,
        'default_graph_version' => 'v2.11',
    ]);
}

function facebookRedirectToFacebookLoginPage()
{
    global $service_base_address, $path;

    $fb = facebookInitAPI();

    try{
        $helper = $fb->getRedirectLoginHelper();
        $permissions = ['email','public_profile']; // Optional permissions
        $loginUrl = $helper->getLoginUrl($service_base_address.$path['facebook_registration'].'?response=1', $permissions);
        header('Location: '.$loginUrl);
    }catch(Exception $e)
    {
        die($e->getMessage());
    }
}

/* Gets user profile from Facebook and register it as user in this service. 
@exceptions May generate FacebookRequestException, Exception
*/
function facebookGetUserAndRegister()
{
  global $path, $facebook_client_id, $service_base_address;


    $fb = facebookInitAPI();

    $helper = $fb->getRedirectLoginHelper();

    try {
        $accessToken = $helper->getAccessToken();
    } catch(Facebook\Exceptions\FacebookResponseException $e) {
        // When Graph returns an error
        echo 'Graph returned an error: ' . $e->getMessage();
        exit;
    } catch(Facebook\Exceptions\FacebookSDKException $e) {
        // When validation fails or other local issues
        echo 'Facebook SDK returned an error: ' . $e->getMessage();
        exit;
    }

    if (! isset($accessToken)) {
        if ($helper->getError()) {
            header('HTTP/1.0 401 Unauthorized');
            echo "Error: " . $helper->getError() . "\n";
            echo "Error Code: " . $helper->getErrorCode() . "\n";
            echo "Error Reason: " . $helper->getErrorReason() . "\n";
            echo "Error Description: " . $helper->getErrorDescription() . "\n";
        } else {
            header('HTTP/1.0 400 Bad Request');
            echo 'Bad request';
        }
        exit;
    }

// Logged in

// The OAuth 2.0 client handler helps us manage access tokens
    $oAuth2Client = $fb->getOAuth2Client();

// Get the access token metadata from /debug_token
    $tokenMetadata = $oAuth2Client->debugToken($accessToken);

// Validation (these will throw FacebookSDKException's when they fail)
    $tokenMetadata->validateAppId($facebook_client_id); // Replace {app-id} with your app id
// If you know the user ID this access token belongs to, you can validate it here
//$tokenMetadata->validateUserId('123');
    $tokenMetadata->validateExpiration();

    if (! $accessToken->isLongLived()) {
        // Exchanges a short-lived access token for a long-lived one
        try {
            $accessToken = $oAuth2Client->getLongLivedAccessToken($accessToken);
        } catch (Facebook\Exceptions\FacebookSDKException $e) {
            echo "<p>Error getting long-lived access token: " . $helper->getMessage() . "</p>\n\n";
            exit;
        }

    }

    //$_SESSION['fb_access_token'] = (string) $accessToken;


    $fb->setDefaultAccessToken($accessToken);
    $response = $fb->get('/me?locale=en_US&fields=id,gender,first_name,last_name,name,email');
    $userNode = $response->getGraphUser();

    $facebookId = $userNode->getId();
    $email = $userNode->getEmail();
    $sex = ($userNode->getGender()=='male'?SEX_MALE:SEX_FEMALE);
    $firstName = $userNode->getFirstName();
    $lastName = $userNode->getLastName();
    try
    {
        CreateAccountFromFacebook($facebookId, $email, $firstName, $lastName, $sex);
    }catch(ExceptionRecordAlreadyExists $e)
    {
        //echo($e);
    }catch (Exception $e)
    {
        echo($e->getMessage());
    }

}

