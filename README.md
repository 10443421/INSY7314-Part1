# HustleHub+ API (Part 1: Secure Foundations)

HustleHub+ is a freelance marketplace platform. Freelancers advertise the work they do, clients browse those listings and book them, and the system keeps a record of the money that moves through those bookings so a freelancer can see what they have earned and roughly what they owe SARS at the end of the year.

This repository is Part 1 of the project, which is the backend foundation. It covers user registration, login, and the security around those two things. Gigs, bookings, transactions and the React frontend are built in Part 2. We started with security here rather than adding it later, because the data this platform holds (passwords, contact details, earnings) is exactly the kind of data that causes real damage when it leaks.
  
**Demonstration video:** <https://youtu.be/VjVBKxKAJ6Q>

---

## Who the system is for

The platform has three types of user, and each one gets a different level of access. The role is chosen at registration and stored on the user record, and it is also carried inside the login token so the API knows who is asking before it answers.

- **Freelancer** lists gigs, receives bookings, and tracks income and estimated tax on a dashboard.
- **Client** browses gigs and books freelancers.
- **Admin** oversees the platform and its users.

Role-based access control is only partly visible in Part 1, because the only protected route so far is the profile route. What Part 1 does do is put the role into the token itself, so that in Part 2 we can restrict a route to one role without going back to the database on every request.

---

## Scope of Part 1

Built in this part:

- A Node.js and Express REST API
- User registration with password hashing
- Login that returns a JSON Web Token (JWT)
- A protected route that only works with a valid token
- Input validation on everything the user sends
- HTTPS support using a locally generated SSL certificate, toggled by a configuration flag
- Error responses that give the user nothing useful about the internals
- Postman tests for the working cases and the broken ones

Not built yet: MongoDB, the React frontend, gigs, bookings, transactions, income tracking, tax estimates, Docker and the CI/CD pipeline. Users are held in an in-memory array for now, which the brief allows at this stage.

---

## System architecture

HustleHub+ is built on the MERN stack: MongoDB, Express, React and Node.js. The diagram below shows the full system, with the parts that exist in Part 1 marked as built and the rest marked as planned.

![System architecture design] (system_architecture_design.jpeg)

The three tiers are kept apart on purpose. The client never talks to the data layer, and it never sees a password hash or the JWT secret. Everything it is allowed to do has to go through an Express route first, so there is one place where the rules get enforced instead of many.

---

## Request flow

**Registration (`POST /api/auth/register`)**

1. The request arrives over HTTPS and is decrypted.
2. Helmet sets the security headers, CORS checks the origin, and the body parser rejects anything over 10kb.
3. `validateRegisterInput` checks that name, email, password and role are all present, that they are all strings, that the lengths are sensible, that the email looks like an email, and that the role is one of the three we allow. If any check fails the request stops here with a 400 and never reaches the controller.
4. The controller checks whether the email is already registered. If it is, it returns 409.
5. bcrypt hashes the password with 12 salt rounds.
6. The user record is stored with the hash in place of the password.
7. A 201 is returned with the id, name, email and role. The password field is deliberately left out of the response. The key on this one response is `date` rather than `data`, which is a naming slip we have carried into the Postman assertions to keep them consistent. It is listed under known limitations and gets corrected in Part 2.

**Login (`POST /api/auth/login`)**

1. Same first two steps as above.
2. `validateLoginInput` checks that email and password are present, are strings, and that the email is in a valid format.
3. The controller looks up the user by email.
4. bcrypt compares the submitted password against the stored hash.
5. If either the email or the password is wrong, the API returns 401 with the same message for both cases: `Invalid email or password`. This is intentional. If we said "no account with that email" the response would confirm to an attacker which addresses are registered, which is a free list of targets.
6. If the details are right, a JWT is signed containing the user's id, email and role, set to expire after one hour.
7. The token is returned to the client, along with basic profile information.

**Using the token (`GET /api/auth/profile`)**

The client sends the token back in an `Authorization: Bearer <token>` header. `authMiddleware` pulls the token out, verifies the signature against the secret, and attaches the decoded payload to `req.user`. Only then does the controller run. A missing token gets a 401, and a tampered or expired one gets a 403.

---

## Backend structure

The backend is split by responsibility, so no single file is doing routing, validation and business logic at the same time. This makes each piece easier to test and easier to swap out later, which matters because in Part 2 the in-memory array gets replaced by MongoDB and we want that change to only touch the controllers.

```
api/
├── index.js                        # Entry point: middleware, routes, HTTPS server
├── routes/
│   └── authRoutes.js               # Maps URLs to middleware and controllers
├── controllers/
│   └── authController.js           # Register, login and profile logic
├── middleware/
│   ├── validateAuthInput.js        # Checks and cleans user input
│   ├── authMiddleware.js           # Verifies the JWT on protected routes
│   └── errorHandler.js             # Central error handling
├── certs/                          # Local SSL key and certificate (not committed)
├── .env                            # Configuration and secrets (not committed)
├── .gitignore
└── package.json
```

Routes only decide which middleware and controller a URL goes to. Validation and the JWT check sit in middleware so they run before any logic does, and the controllers can assume the data reaching them is already clean. Anything that throws ends up at the single error handler.

Middleware order in `index.js` is not accidental. Helmet and CORS run before the body parser, so a request from a disallowed origin is turned away before we spend any effort parsing what it sent.

---

## API endpoints
 
Base URL: `http://localhost:4000` by default. The server switches to `https://localhost:4000` when `USE_HTTPS` is set to true in `.env` and the local certificate is in place. Full request and response bodies for every endpoint, including the failure cases, are visible in the Postman screenshots further down.
 
| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | No | Confirms the API is running |
| GET | `/health` | No | Returns status and whether HTTPS is on |
| POST | `/api/auth/register` | No | Creates a new user |
| POST | `/api/auth/login` | No | Authenticates and returns a JWT |
| GET | `/api/auth/profile` | Yes | Returns the logged-in user's details |
 
### Status codes
 
| Code | When |
|------|------|
| 200 | Login worked, or a protected route returned data |
| 201 | A user was created |
| 400 | Input failed validation |
| 401 | Wrong login details, or no token on a protected route |
| 403 | Token was present but invalid or expired |
| 404 | The route does not exist |
| 409 | That email is already registered |
| 500 | Something went wrong on the server |

(Pandey, 2026)
 
---

## Security decisions and why we made them
 
### Password hashing with bcrypt
 
Passwords are hashed with bcrypt at 12 salt rounds before anything is stored. The plain password is never written to the array, to a log, or to a response. The guidance is a work factor of at least 10, set as high as the server can handle, so 12 sits above that floor (OWASP, 2024).
 
Hashing only works one way. Nobody can turn a hash back into the original password, so even someone who gets hold of all our stored data cannot read the passwords out of it.
 
We picked bcrypt over a plain hash like SHA-256 for two reasons.
 
The first is salting. The bcrypt library adds a unique random value to each password before hashing it. That means an attacker has to crack the hashes one at a time instead of working out one hash and comparing it to all of them. It also blocks rainbow tables, which are pre-built lists of hashes. And two users who pick the same password still end up with different hashes (OWASP, 2024).
 
The second is speed. Fast hashes like SHA-256 are a bad fit for passwords because an attacker can try a huge number of guesses very quickly. bcrypt is slow on purpose, and you can choose how slow (OWASP, 2024). At 12 rounds a real login takes a fraction of a second, which no user notices, but guessing at scale becomes expensive. The work factor can be raised later as computers get faster, though old hashes keep their original setting until the user logs in again and we re-hash the password (OWASP, 2024).
 
This matters on a platform like ours because people reuse passwords. If ours leaked, the damage would not stop at HustleHub+. It would follow our users to their email and their banking.
 
### JSON Web Tokens for authentication
 
When a login succeeds, the API signs a JWT holding the user's id, email and role, and sets it to expire after an hour.
 
We used tokens instead of sessions on the server. The token is sent back in the Authorization header using the Bearer schema, and a protected route checks the token itself instead of looking up a session. jwt.io describes this as a stateless authorization mechanism in certain cases (JWT.io, 2024). The server does not need to remember who is logged in. It only has to check that the token was signed with our secret and has not expired. That also means we can run the API on more than one instance later without sharing session storage between them, which matters once it is containerised in Part 3.
 
The payload holds only what the API needs to make a decision, which is who the user is and what role they have. It holds no password hash and nothing else sensitive. This is deliberate, because a JWT is signed rather than encrypted, so anyone who gets hold of one can read what is inside it (JWT.io, 2024). Signing does still prove the token has not been changed. Editing the payload breaks the signature, and `jwt.verify` throws.
 
Tokens are credentials, and the guidance is not to keep them longer than needed (JWT.io, 2024). One hour is our compromise. Any shorter and users get logged out in the middle of something. Any longer and a stolen token stays useful for days (GeeksforGeeks, 2026).
 
The signing secret sits in `.env` and is loaded with `dotenv`, so it is never typed into a file that gets committed.
 
### Input validation
 
We do not trust anything the user sends (Express, 2024). Both auth routes pass through validation middleware before the controller runs. It checks that the required fields are present, that each one is a string, that the name and password are a sensible length, that the email looks like an email, and that the role is Client, Freelancer or Admin.
 
The role check is a whitelist, not a blacklist (Clarke, 2009). We are not trying to guess every bad value someone might send. We accept the three we know are right and reject everything else.
 
Input is trimmed, and emails are made lowercase. Without that, `Thabo@Example.com ` and `thabo@example.com` could become two separate accounts.
 
Validating early also protects what sits underneath. Once MongoDB arrives in Part 2, an unchecked object in the request body could be used for NoSQL injection, which OWASP lists as a common form of injection alongside SQL, OS command and LDAP (OWASP, 2021). Forcing every field to be a string before it goes near a query shuts that down.
 
### HTTPS
 
HTTPS is built into index.js using the Node.js https module (Node.js, 2024). At startup the server reads the USE_HTTPS flag from .env. When it is true, it loads the key and certificate from SSL_KEY_PATH and SSL_CERT_PATH and starts an HTTPS server instead of an HTTP one. The certificate itself is generated locally with OpenSSL rather than issued by a certificate authority.

We put it behind a flag because the certificate is gitignored and does not travel with the repository, so a fresh clone would otherwise fail to start until someone generated one.
 
Without TLS everything travels as readable text. Anyone on the same network, which for many of our users means a coffee shop or campus wifi, could read a password out of a login request or copy a JWT out of a header and use it themselves. Unencrypted traffic is open to packet sniffing and man-in-the-middle attacks (Express, 2024). TLS encrypts the whole exchange, and the certificate also proves the client is talking to our server rather than to something pretending to be it. On a platform holding login details and income figures, that is not optional in production.
 
Our certificate is self-signed, so browsers warn about it and Postman needs SSL verification switched off to connect. That is normal for a local certificate. In production it would be replaced by one from a trusted certificate authority.
 
### Security headers, CORS and payload limits
 
Helmet sets a group of response headers that tell the browser to be more careful. They include a Content Security Policy that limits scripts and styles to our own origin, blocks plugin content, and stops the site being loaded inside an iframe (Express, 2024). That last one prevents clickjacking, where an attacker hides our page underneath theirs and tricks a user into clicking something they cannot see.
 
We also turned off the `X-Powered-By` header. Express switches it on by default, which announces the framework in every response and tells an attacker which vulnerabilities to go looking up (Express, 2024).
 
CORS only accepts the one origin held in `CLIENT_ORIGIN`, and only the methods and headers we use. If we left it open, any website could make requests to our API using a logged-in user's browser (Pandey, 2026).
 
The JSON body parser is capped at 10kb. A registration or login body is tiny, so nothing legitimate needs more. Without a cap, someone could send huge bodies over and over and tie up server memory, which is a cheap way to knock the API over.
 
### Controlled error handling
 
Every error ends up at one error handler. It logs the real message on the server, where we can read it, and sends back a plain `Internal server error` to the client.
 
Default framework errors give away too much. A stack trace shows file paths, folder structure, package versions and sometimes database details, which hands a map of the system to whoever is poking at it (Express, 2024). Unknown routes get a plain 404 instead of a default HTML error page, for the same reason.
 
### Keeping secrets out of the repository
 
Configuration lives in `.env` and is loaded with `dotenv` rather than being written into the code. Embedding secrets directly in code or config files is a risk because if a codebase becomes comprimised then the are compromised secrets too, and using environment variables instead is the recommended way to keep them out of source (Microsoft, 2026). Both `.env` and the `certs/` folder are in `.gitignore` so the signing secret and the private key stay off GitHub. A secret in a public repository is not a secret. Anyone who finds ours could sign their own tokens and log in as any user, including an Admin.
 
We have to be honest about one thing. Our `.env` was committed early on, before the ignore rule was added, so the development secret is in this repository's history. The standard guidance for a secret that has been exposed like this is to treat it as compromised and rotate it immediately rather than wait (Microsoft, 2026). It is a throwaway value we only use on our own machines, and it would be untracked and replaced before this went anywhere real. Keeping it in `.env` rather than hard-coded in `index.js` is what makes that a one-line change.
 
---

## Testing with Postman

The Postman collection is stored in this repository under `postman/`, saved in Postman's Git integration format rather than as a single exported file:

- `postman/collections/HustleHub+ API/` holds the requests, split into an **Auth** folder for the successful path and an **Error Scenarios** folder for everything that should fail
- `postman/environments/HustleHub+ Local.environment.yaml` holds the `baseUrl` and a `token` variable that the login request writes to automatically, so the profile request picks it up without anyone pasting a token by hand

Fourteen requests carry thirty-six assertions between them. The last full run passed all thirty-six with no failures and no errors.

**Auth (successful path)**

- Register a valid user, 201, with the user returned and no password field present
- Log in with correct details, 200, with a JWT in the response
- Get the profile with a valid token, 200, with the user's details

**Error scenarios**

- Register with a duplicate email, 409
- Register with a badly formatted email, 400
- Register with a role that is not on the allowed list, 400
- Register with fields missing, 400
- Register with a password shorter than 8 characters, 400
- Log in with fields missing, 400
- Log in with an email that does not exist, 401
- Log in with the wrong password, 401, and the same message as the previous test
- Get the profile with no Authorization header, 401
- Get the profile with an edited token, 403
- Request a route that does not exist, 404

Each test checks the full response, not just the status code, so the message and fields also have to be correct. One test makes sure the password never comes back in the registration response, since a good status code on a response that leaks a password hash would still be a failure.

Testing the failures mattered as much as testing success. It's easy to build an API where registration works fine but also lets a blank password through.

---

## Screenshots

Screenshots of the API responses are in `postman/Postman Testing Screenshots/`. They are captures of the Postman Collection Runner rather than one request at a time, so each one shows the request, the URL, the status code, the response time and every assertion that ran against it.

- `Testing 1.png` - the run summary showing 36 tests passed and 0 failed, followed by the successful registration (201) and login (200)
- `Testing 2.png` and `Testing 3.png` - the rest of the successful path and the start of the error scenarios
- `Testing 4.png` - the remaining error cases, including a 400 on missing login fields, a 401 with no token, a 403 on a tampered token, and a 404 on an unknown route

---


## Team 
- Caitlyne Allison Lessing, ST10443399 - API functionality and HTTPS Implementation
- Ethan Hughes, ST10438080 - README
- Madiki Caleb Kabelo Phoshoko, ST10443421 - Checking code structure and Postman Testing
- Gomolemo Ramalope, ST10308017 - Video Demonstration and Architecture Diagram

All work was committed to this repository, and the commit history shows who worked on what.

---

## References

Clarke, J., 2009. *SQL Injection Attacks and Defense*. [Online] Syngress. Available at: <https://www.sciencedirect.com/book/9781597494243/sql-injection-attacks-and-defense> [Accessed 7 September 2026].

Express, 2024. *Production Best Practices: Security*. [Online] Available at: <https://expressjs.com/en/advanced/best-practice-security.html> [Accessed 7 September 2026].

GeeksforGeeks, 2026. *JSON Web Token (JWT)*. [Online] Available at: <https://www.geeksforgeeks.org/web-tech/json-web-token-jwt/> [Accessed 7 September 2026].

JWT.io, 2024. *Introduction to JSON Web Tokens*. [Online] Available at: <https://jwt.io/introduction> [Accessed 7 September 2026].

Microsoft, 2026. Best Practices for Protecting Secrets. [Online] Microsoft Learn. Available at: <https://learn.microsoft.com/en-us/azure/security/fundamentals/secrets-best-practices> [Accessed 7 September 2026].

Node.js, 2024. *Node.js Documentation: HTTPS*. [Online] Available at: <https://nodejs.org/api/https.html> [Accessed 7 September 2026].

Oladimeji Ipaye | Data Pro  (2026). How to Write an Effective README File for Github Projects in 2026 (Complete Guide + Free Tool). [Online] Available at: <https://www.youtube.com/watch?v=nN59j4TELcE> [Accessed 7 Sept. 2026].

OWASP, 2021. *A03:2021 - Injection*. [Online] Available at: <https://owasp.org/Top10/2021/A03_2021-Injection/> [Accessed 7 September 2026].

OWASP, 2024. *Password Storage Cheat Sheet*. [Online] Available at: <https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html> [Accessed 7 September 2026].

Pandey, A., 2026. *Understanding HTTP for Backend Engineers: Where It All Starts*. [Online] JavaGuides. Available at: <https://medium.com/javaguides/understanding-http-for-backend-engineers-where-it-all-starts-56c633b9bb0e> [Accessed 7 September 2026].

The Independent Institute of Education (IIE), 2025. *APPLICATION DEVELOPMENT SECURITY* [INSY7314 Module Manual] The Independent Institute of Education: Unpublished.
