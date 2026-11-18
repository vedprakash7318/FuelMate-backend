const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const { ownerOnly } = require('../middleware/roleCheck');

// All employee management routes are owner-only
router.use(auth, ownerOnly);

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/password', userController.resetPassword);
router.get('/:id/activity', userController.getUserActivity);

module.exports = router;

