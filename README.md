# boggle-server
Node server to create boggle boards and facilitate multiplayer clients

## Setup ##
* Clone repository and run npm install
* Before attempting to run, make sure you have your .env file set up. This will require a certificate and key for SSL. Follow a guide similar to this (https://itnext.io/node-express-letsencrypt-generate-a-free-ssl-certificate-and-run-an-https-server-in-5-minutes-a730fbe528ca)

The .env file needs to contain the following fields
```env
SESSION_SECRET=secret123
CERT_PATH="/path/to/cert.pem"
KEY_PATH="/path/to/key.pem"
PORT=443
```

Additionally, the ` CA ` field is optional and points to a ` .chain ` file if you're using a certificate from an authority

## Usage ##
After the server is up and running, you can navigate to the root and go to the login page. This will let you sign up with your new username/password.
Note that there can only be one account for security reasons so you'll need to log in with that original account later. Right now the only option if you forget the password is to manually open the users.sqlite database and delete your record.


When logged in, the only real page you care about is "Change requests". The interface there is two lists of words that users have requested you either add or remove from the database that generates puzzles. Simply check the box next to any change you agree with, ignoring those you don't. When you are done, click "Process" at the bottom and all changes are committed. **Note that after clicking the button, all requests are deleted so you need to process the whole list in one go or risk losing information**
