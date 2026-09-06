//line2-10 The IIE (2014, p.39)
const errorHandler = (err, req, res, next) => {
    console.error(err.message); //logs server-side error message

    res.status(500).json({
        error: 'Internal server error'  
    });
};

module.exports = errorHandler

//Reference List
//The Independent Institute of Education (IIE), 2025. APPLICATION DEVELOPMENT SECURITY [INSY7314 Module Manual] The Independent Institute of Education: Unpublished.