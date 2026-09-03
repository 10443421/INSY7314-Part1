const allowedRoles = ['Client', 'Freelancer', 'Admin']; //list of roles for HustleHub+

const validateRegisterInput = (req, res, next) => {
    const{ name, email, password, role} = req.body;

    //checks if all fields have input
    if (!name || !email || !password || !role)
    {
        return response.status(400).json({error: 'All fields are required'})
    }

    //makes sure all input is a string
    if ( typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof role !== 'string'  )
    {
        return res.status(400).json({error: "All fields must be text values"});
    }

    //removes whitespace and makes email normal casing
    const trimedName = name.trim();
    const trimedEmail = email.trim().toLowerCase();
    const trimedPassword = password.trim();
    const trimedRole = role.trim();

    if(trimedName.length < 2 || trimedName.length > 50)
    {
        return res.status(400).json({error: 'Name must be between 2 and 50 characters'});
    }

    const emailReg = /^\S+@S+\.\S+$/;
    if (!emailReg.test(trimedEmail))
    {
        return res.status(400).json({error: 'Invalid email address format'});
    }

    if(trimedPassword.length < 8 || trimedPassword.length > 64){
        return res.status(400).json({error: 'Password must be between 8 and 64 characters'});
    }

    if (!allowedRoles.includes(trimedRole)){
        return res.status(400).json({error: 'Role must be Client, Freelancer or Admin'});
    }

    req.body = 
    {
        email: trimedEmail,
        password: trimedPassword
    };
    next();
};

const validateLoginInput = (req, res, next) => {
    const {email, password} = req.body;

    //checks if both are submitted
    if(!email || !password)
    {
        return res.status(400).json({error: 'Email and password are required'});
    }

    if (typeof email !== 'string' || typeof password !=='string')
    {
        return res.status(400).json({error: ' All fields must be text values'});
    }

    const trimedEmail = email.trim().toLowerCase();
    const trimedPassword = password.trim();

    const emailReg = /^\S+@S+\.\S+$/;
    if (!emailReg.test(trimedEmail))
    {
        return res.status(400).json({error: 'Invalid email address format'});
    }

    req.body = {
        email: trimedEmail,
        password: trimedPassword
    };

    next();
};