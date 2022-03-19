# boggle-server
Node server to create boggle boards and facilitate multiplayer clients

## Setup ##
* Clone repository and run npm install
* Before attempting to run, make sure you have your .env file set up. This will require a certificate and key for SSL. Follow a guide similar to this (https://itnext.io/node-express-letsencrypt-generate-a-free-ssl-certificate-and-run-an-https-server-in-5-minutes-a730fbe528ca)
* ` sudo nodejs main.js `

### .env file setup ###
The .env file needs to contain the following fields
```env
SESSION_SECRET=secret123
CERT_PATH="/path/to/cert.pem"
KEY_PATH="/path/to/key.pem"
PORT=443
GAME_LENGTH=180
ROOMCODE_BYTES=2
MAX_MULTIBOARD_GEN=10
```
_notes:_
* `GAME_LENGTH` _is the number of seconds for multiplayer games only. Single player length is set on the client side_
* `ROOMCODE_BYTES` _is effectively half the length of a final hex code for a room. So two bytes will turn into a four-character code_
* `CA` _is optional and points to a ` chain.pem ` file if you're using a certificate from an authority_
* `MAX_MUTLIBARD_GEN` _caps the number of boards that a client can generate in a single request

### Word definition API ###
The server is able to fetch definitions of words as requested by users. The default source is "Free Dictionary API" (https://dictionaryapi.dev/), but support has been added for Merriam Webster. Performance is much better, but registration for an API key is required and usage is capped. To register for an API key, visit https://dictionaryapi.com/register/index. Request "Collegiate Dictionary" access when choosing the kind of key to receive. After getting a key, add it to your .env file or log into the frontend and enter it on the settings page. Presence of a key in the .env file will cause the definition method to automatically switch from the default .env example:
```env
MERRIAM_WEBSTER_API_KEY=[your api key]
```

### .apiToken file ###
If you want your server to be secured with an api token, you simply put the value into the `.apiToken` file. The token can also be changed later from the settings page of the interface after logging in. **If you use a token, users who wish to make requests to the server either by API or with a mobile app will need to be told so they can enter it**

#### Setting up for certbot ####
If you're using the guide linked above and need to validate your domain, you can run the ` certSetup.js ` server temporarily.

## Usage ##
After the server is up and running, you can navigate to the root and go to the login page. This will let you sign up with your new username/password.
Note that there can only be one account for security reasons so you'll need to log in with that original account later. Right now the only option if you forget the password is to manually open the users.sqlite database and delete your record.


When logged in, the main page you care about is "Change requests". The interface there is two lists of words that users have requested you either add or remove from the database that generates puzzles. Simply check the box next to any change you agree with, ignoring those you don't. When you are done, click "Process" at the bottom and all changes are committed. **Note that after clicking the button, all requests are deleted so you need to process the whole list in one go or risk losing information**.

Aside from the changes page there is also a settings page that allows you to:
* Download a copy of the current dictionary in .txt format
* Upload a .txt file to replace the current dictionary (one word per line)
* View/change the current API token. Pressing the save button while the field is blank will clear the settings so that there is no longer a token at all
* Control a subset of the .env variables
