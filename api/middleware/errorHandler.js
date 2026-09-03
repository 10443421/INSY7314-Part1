const errorHandler = (err, req, res, next) => {
    console.error(err.message); //logs server-side error message

    res.status(500).json({
        error: 'Internal server error'  
    });
};

module.exports = errorHandler