const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const superAdminController = require('../controllers/superAdminController');

// All Super Admin routes require authentication + SuperAdmin role
router.use(auth, requireSuperAdmin);

// Dashboard
router.get('/dashboard', superAdminController.getDashboard);

// Pumps & Admins
router.get('/pumps', superAdminController.getPumps);
router.post('/pumps', superAdminController.createPumpAndAdmin);
router.put('/pumps/:pumpId', superAdminController.updatePump);
router.patch('/pumps/:pumpId/block', superAdminController.toggleBlockPump);
router.post('/pumps/:pumpId/subscription', superAdminController.extendSubscription);
router.patch('/pumps/:pumpId/reset-password', superAdminController.resetAdminPassword);

// Subscription Plans CRUD
router.get('/plans', superAdminController.getPlans);
router.post('/plans', superAdminController.createPlan);
router.put('/plans/:id', superAdminController.updatePlan);
router.delete('/plans/:id', superAdminController.deletePlan);

// Subscription History / Audit
router.get('/subscriptions/history', superAdminController.getSubscriptionHistory);

module.exports = router;
