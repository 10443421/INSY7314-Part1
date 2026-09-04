const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
//const { use } = require('react');

//In-memory data for part 1 before physical DB 
const users = [];

//register a new user
const registerUser = async (req, res, next) => {
    try{
        const {name, email, password, role} = req.body;

        //checking if user exsists in array
        const existingUser = users.find((user) => user.email === email);
        if (existingUser){
            return res.status(409).json({error: 'User with this email already exsists'});
        }

        //Hashes passsword with 12 salt rounds
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        //Builds user record with the hashed password
        const newUser = {
            id: `u${users.length +1}`,
            name,
            email,
            password: hashedPassword,
            role
        };

        //store in-memory list
        users.push(newUser);

        //return successful without returning the password hashed
        res.status(201).json({
            message:'User registered successfully',
            date: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    }catch(error){
        //pass errors to errorHadler middleware
        next(error);
    }
};

//log in an existing user
const loginUser = async (req, res, next) => {
    try{
        const{email, password} = req.body;

        //Verify is user exists in the local array
        const user = users.find((u) => u.email === email);
        if(!user){
            return res.status(401).json({error: 'Invalid email or password'});
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!user){
            return res.status(401).json({error: 'Invalid email or password'});
        }

        //return signed JWT token including user payload
        const token = jwt.sign(
            {
                id: user.id, email: user.email, role: user.role
            },
            process.env.JWT_SECRET || 'fallback_secret',
            {expiresIn: process.env.JWT_EXPIRES_IN   || '1h'}
        );

        //return bearer token and basic profile info
        res.status(200).json({
            message: 'Login successful',
            token,
            user:{id: user.id, name: user.name, email: user.email, role: user.role}
        });
    }catch(error){
        next(error);
    }
};

//get cuurently authenticated user's profile (protected)
const getUserProfile = (req, res) => {
    //look up user by id embedded inside the verified JWT token (req.user)

    const user = users.find((u) => u.id === req.user.id);

    if(!user){
        return res.status(401).json({error: 'User not found'});
    }

    res.status(200).json({
            data: {
                id: user.id, name: user.name, email: user.email, role: user.role
            }
        });
};

module.exports = {registerUser, loginUser, getUserProfile};