const express = require('express');
const { createDraftOrderFromCart } = require('../services/draftOrder.service');

const router = express.Router();

router.post('/create-draft-order', async (req, res, next) => {
  try {
    const result = await createDraftOrderFromCart(req.body);
    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
