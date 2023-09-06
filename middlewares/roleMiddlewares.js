const requireRole = (roleList) => {
  return (req, res, next) => {
    const userRole = req?.auth?.user?.system_role;

    if(typeof roleList === 'string') {
      roleList = [roleList];
    }

    const isAuthorized = roleList.includes(userRole);

    if(!isAuthorized) {
      return res.status(403).json({
        error: {
          message: 'Performing this request is not allowed with your system role',
          meesagePersian: 'انجام این درخواست با سطح کابری شما در سیستم مجاز نیست',
        }
      });
    }
    next();
  }
}

module.exports = {
  requireRole,
}