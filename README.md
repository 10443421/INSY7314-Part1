# HustleHub+ API (Part 1: Secure Foundations)

HustleHub+ is a freelance marketplace platform. Freelancers advertise the work they do, clients browse those listings and book them, and the system keeps a record of the money that moves through those bookings so a freelancer can see what they have earned and roughly what they owe SARS at the end of the year.

This repository is Part 1 of the project, which is the backend foundation. It covers user registration, login, and the security around those two things. Gigs, bookings, transactions and the React frontend are built in Part 2. We started with security here rather than adding it later, because the data this platform holds (passwords, contact details, earnings) is exactly the kind of data that causes real damage when it leaks.

**Repository:** [add GitHub repo link here]  
**Demonstration video:** [add video link here]

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
- HTTPS using a locally generated SSL certificate
- Error responses that give the user nothing useful about the internals
- Postman tests for the working cases and the broken ones

Not built yet: MongoDB, the React frontend, gigs, bookings, transactions, income tracking, tax estimates, Docker and the CI/CD pipeline. Users are held in an in-memory array for now, which the brief allows at this stage.

---

## System architecture

HustleHub+ is built on the MERN stack: MongoDB, Express, React and Node.js. The diagram below shows the full system, with the parts that exist in Part 1 marked as built and the rest marked as planned.



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
7. A 201 is returned with the id, name, email and role. The password field is deliberately left out of the response.

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

Base URL: `https://localhost:4000`

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| GET | `/` | No | Confirms the API is running |
| GET | `/health` | No | Returns status and whether HTTPS is on |
| POST | `/api/auth/register` | No | Creates a new user |
| POST | `/api/auth/login` | No | Authenticates and returns a JWT |
| GET | `/api/auth/profile` | Yes | Returns the logged-in user's details |

### POST /api/auth/register

Request:

```json
{
  "name": "Thabo Mokoena",
  "email": "thabo@example.com",
  "password": "Str0ngPassw0rd!",
  "role": "Freelancer"
}
```

Success, `201 Created`:

```json
{
  "message": "User registered successfully",
  "data": {
    "id": "u1",
    "name": "Thabo Mokoena",
    "email": "thabo@example.com",
    "role": "Freelancer"
  }
}
```

### POST /api/auth/login

Request:

```json
{
  "email": "thabo@example.com",
  "password": "Str0ngPassw0rd!"
}
```

Success, `200 OK`:

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "u1",
    "name": "Thabo Mokoena",
    "email": "thabo@example.com",
    "role": "Freelancer"
  }
}
```

### GET /api/auth/profile

Header: `Authorization: Bearer <token>`

Success, `200 OK`:

```json
{
  "data": {
    "id": "u1",
    "name": "Thabo Mokoena",
    "email": "thabo@example.com",
    "role": "Freelancer"
  }
}
```

### Status codes we use

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

Every response, including the errors, is JSON. That keeps the frontend simple in Part 2, because it only ever has to parse one kind of response.

---

## Security decisions and why we made them

### Password hashing with bcrypt

Passwords are hashed with bcrypt using 12 salt rounds before anything is stored, and the plain password is never written to the array, to a log or to a response.

Hashing is one-way, so even someone with full access to our stored data cannot read the passwords back out. We chose bcrypt over a plain hash like SHA-256 for two reasons. First, bcrypt salts every password automatically, so two people who pick the same password end up with different hashes and an attacker cannot crack them both at once with one rainbow table. Second, bcrypt is deliberately slow, and the cost is adjustable. Twelve rounds takes a fraction of a second for one real login, which nobody notices, but it makes guessing millions of passwords per second impractical. As computers get faster the round count can be raised without changing anything else.

This matters more than usual on a platform like ours. People reuse passwords, so a leak from HustleHub+ would not just be our problem, it would follow our users to their email and their banking.

### JSON Web Tokens for authentication

After a successful login the API signs a JWT containing the user's id, email and role, and sets it to expire in one hour.

We used tokens instead of server-side sessions because a REST API should be stateless. The server does not have to remember who is logged in, it just has to check that the token in front of it was signed with our secret and has not expired. That also means the API can scale across more than one instance later without needing shared session storage, which will matter once the app is containerised in Part 3.

The payload only holds what the API needs to make a decision: who the user is and what role they have. It does not hold the password hash or anything else sensitive. A JWT is signed, not encrypted, so anybody who gets hold of one can read the payload. Signing still guarantees that it has not been changed, because editing the payload breaks the signature and `jwt.verify` throws.

The one hour expiry is a compromise. Too short and users get logged out mid-task, too long and a stolen token stays useful for days. An hour keeps the damage window small.

The signing secret lives in `.env` and is loaded through `dotenv`, so it is never hard-coded in a file that gets committed.

### Input validation

Nothing the user sends is trusted. Both auth routes run through validation middleware before the controller sees the request, and that middleware checks that required fields are there, that each one is actually a string, that name and password lengths are within range, that the email matches a valid pattern, and that the role is one of Client, Freelancer or Admin.

The role check is a whitelist rather than a blacklist, which is deliberate. We are not trying to guess every bad value a user might send, we are only accepting the three we know are correct. Anything else is rejected by default.

Input is also trimmed, and emails are lowercased, so `Thabo@Example.com ` and `thabo@example.com` cannot become two separate accounts.

Validating early also protects the layers underneath. Once MongoDB is added in Part 2, an unchecked object in the request body could be used for NoSQL injection. Forcing every field to be a string before it goes anywhere near a query closes that off.

### HTTPS

The API runs over HTTPS using a locally generated SSL certificate, controlled by the `USE_HTTPS` flag in `.env`.

Without TLS, everything travels as readable text. Anyone on the same network, which for a lot of our users means a coffee shop or campus wifi, could read a password straight out of a login request or copy a JWT out of a header and use it themselves. TLS encrypts the whole exchange, and the certificate also proves to the client that it is talking to our server and not to something in the middle pretending to be us.

The certificate we use for development is self-signed, so browsers and Postman will warn about it. That is expected locally. In production it would be replaced with a certificate from a trusted authority.

### Security headers, CORS and payload limits

Helmet sets a group of HTTP response headers that tell the browser to behave more carefully, including a Content Security Policy that limits scripts and styles to our own origin, blocks plugin content, and stops the site being loaded inside an iframe. That last one prevents clickjacking, where an attacker hides our page under theirs and tricks a user into clicking something they cannot see. We also disabled the `X-Powered-By` header, because by default Express announces itself in every response and tells an attacker exactly which framework to look up vulnerabilities for.

CORS is restricted to a single origin, the frontend URL held in `CLIENT_ORIGIN`, and only allows the methods and headers we actually use. A wide-open CORS policy would let any website on the internet make requests to our API using a logged-in user's browser.

The JSON body parser is capped at 10kb. Registration and login bodies are tiny, so there is no legitimate reason for a bigger one. Without a cap, someone could send a huge body repeatedly and tie up server memory, which is a cheap denial of service.

### Controlled error handling

All errors go to one error handler. It logs the real message on the server, where we can see it, and returns a plain `Internal server error` to the client.

Default framework errors leak a lot. A stack trace gives away file paths, folder structure, package versions and sometimes database details, which is a map of the system handed to whoever is probing it. Unknown routes get a simple 404 rather than a default HTML error page, for the same reason.

### Keeping secrets out of the repository

`.env` and the `certs/` folder are both listed in `.gitignore`, so the JWT secret and the private key are never pushed to GitHub. A secret in a public repository is not a secret. Anyone who finds it can sign their own tokens and log in as any user they like, including an Admin.

---

## Testing with Postman



---

## Screenshots

Screenshots of the API responses 

---

## Known limitations

We know about these, and they are either allowed at this stage or scheduled for later parts.

- **Users are stored in memory.** Everything is lost when the server restarts. The brief allows this for Part 1, and MongoDB replaces it in Part 2.
- **The SSL certificate is self-signed.** Fine locally, replaced by a proper certificate in production.
- **No rate limiting on login yet.** Nothing currently stops repeated password guesses. We plan to add `express-rate-limit` and account lockout in a later part.
- **No refresh tokens.** When the hour is up the user logs in again.
- **Role-based access control is only partly in place.** The role is inside the token, but no route restricts by role yet because there is nothing to restrict.
- **Password strength is only checked by length.** A minimum of 8 characters is a floor, not a strong rule. Complexity requirements and a check against known breached passwords would be an improvement.

---

## Team

- Caitlyne Allison Lessing, ST10443399 - API functionality and HTTPS Implementation
- Ethan Hughes, ST10438080 - README
- Madiki Caleb Kabelo Phoshoko, ST10443421 - Checking code structure and Postman Testing
- , ST10308017 - Video Demonstration

All work was committed to this repository, and the commit history shows who worked on what.

---

## References

Express, 2024. *Production Best Practices: Security*. [Online] Available at: https://expressjs.com/en/advanced/best-practice-security.html [Accessed 6 September 2026].

Helmet, 2024. *Helmet.js Documentation*. [Online] Available at: https://helmetjs.github.io/ [Accessed 6 September 2026].

JWT.io, 2024. *Introduction to JSON Web Tokens*. [Online] Available at: https://jwt.io/introduction [Accessed 6 September 2026].

Node.js, 2024. *Node.js Documentation: HTTPS*. [Online] Available at: https://nodejs.org/api/https.html [Accessed 6 September 2026].

OWASP, 2021. *OWASP Top 10: 2021*. [Online] Available at: https://owasp.org/Top10/ [Accessed 6 September 2026].

OWASP, 2024. *Password Storage Cheat Sheet*. [Online] Available at: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html [Accessed 6 September 2026].Accessed 6 September 2026].
