const express = require('express');
const router = express.Router();
const { getCommunities, createCommunity } = require('../modules/community');
const upload = require('../config/multer');

// GET: List
router.get('/', async (req, res) => {
  try {
    const communities = await getCommunities();
    res.render('community', { communities });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// POST: Created
router.post('/create', upload.single('Picture'), async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const { CommunityName, Keywords } = req.body;
  const image = req.file ? req.file.filename : null;
  const CreatorID = req.session.user.UserID;

  try {
    await createCommunity(CommunityName, Keywords, image, CreatorID);
    res.redirect('/community');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating community');
  }
});


module.exports = router;
