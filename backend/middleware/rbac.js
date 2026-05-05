/**
 * Role-Based Access Control (RBAC) Middleware
 * Authorizes actions based on user roles
 */

/**
 * Authorize Teacher Role
 * Only teachers can access protected routes
 */
const authorizeTeacher = (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Teacher role required.' 
    });
  }
  next();
};

/**
 * Authorize Student Role
 * Only students can access protected routes
 */
const authorizeStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Student role required.' 
    });
  }
  next();
};

/**
 * Authorize Both Roles
 * Both teachers and students can access
 */
const authorizeBoth = (req, res, next) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'student') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Invalid role.' 
    });
  }
  next();
};

module.exports = {
  authorizeTeacher,
  authorizeStudent,
  authorizeBoth
};
