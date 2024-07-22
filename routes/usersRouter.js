const express = require('express');
const User = require('../schema/users');
const auth = require('../middleware/auth');

const router = express.Router();
const multer = require('multer');
const upload = multer({
    limits: {
        fileSize: 5242880 // 5 MB
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|png|JPG|PNG|jpeg|JPEG)$/)) {
            return cb(new Error("File format incorrect"))
        }
        cb(undefined, true)
    }
})

router.post('/users/login', async (req, res) => {
    try {
        const deviceToken = req.body.deviceToken;
        const user = await User.findByCredential(req.body.email, req.body.password);
        const token = await user.generateAuthToken(deviceToken);
        res.status(200).send({ user, token });
    } catch (e) {
        res.status(400).send({ error: e.message });
        console.log(e);
    }
});

router.post('/users/verify', async (req, res) => {
    try {
        const user = await User.findByCredential(req.body.email, req.body.password);
        res.status(200).send({ user });
    } catch (e) {
        res.status(400).send(e.message);
        console.log(e);
    }
});

router.post('/users/userExists/:email', async (req, res) => {
    try {
        const email = req.params.email
        const user = await User.findOne({ email });
        if (user) {
            if (user.isGoogleAccount) {
                res.status(400).send("Email exisis for a Google Account");
            } else {
                res.status(400).send("User email exisis");
            }
        } else {
            res.status(200).send();
        }
    } catch (e) {
        res.status(400).send(e.message);
        console.log(e);
    }
});

// User logout

router.post('/users/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
        await req.user.save();
        res.status(200).send(req.user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

router.post('/users/logout/all', auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.status(200).send(req.user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Create a new user

router.post('/users', async (req, res) => {
    const user = new User(req.body);
    try {
        if (/\s/.test(req.body.userName.trim())) {
            res.status(400).send('Username should not contain spaces');
        } else {
            const token = await user.generateAuthToken(req.body.deviceToken);
            await user.save();
            res.status(201).send({ user, token });
        }
    } catch (e) {
        if (e.keyValue && e.keyValue.email === user.email) {
            res.status(400).send('Email already exists');
            console.log(e.message);
        } else if (e.keyValue && e.keyValue.userName === user.userName) {
            res.status(400).send('Username already exists');
            console.log(e.message);
        } else {
            res.status(400).send(e.message);
            console.log(e.message);
        }
    }
});

// list users

router.get('/users', auth, async (req, res) => {
    try {
        const user = req.user;
        const users = await User.find({ _id: { $ne: user._id } });
        if (!users || users.length === 0) {
            return res.status(404).send("No Users Found");
        }
        res.status(200).send(users);
    } catch (e) {
        res.status(500).send(e);
        console.log(e);
    }
});


// avater image

router.post('/users/avatar/:userName', upload.single('avatar'), async (req, res) => {
    try {
        const userName = req.params.userName;

        const user = await User.findOne({ userName });

        if (!user) return res.status(404).send("User Not Found");

        user.avatar = req.file.buffer;

        await user.save();

        res.status(200).send(user);
    } catch (e) {
        // Handle errors
        res.status(400).send({ error: e.message });
        console.error(e);
    }
});


// show avatar

router.get('/users/:id/avatar', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user || !user.avatar) {
            throw new Error();
        }

        res.set('Content-Type', 'image/png');
        res.status(200).send(user.avatar);
    } catch (e) {
        res.status(404).send();
    }
});

// list user using headers

router.get('/users/me', auth, async (req, res) => {
    try {
        res.status(200).send(req.user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// find user by id

router.get('/users/:id', async (req, res) => {
    console.log(req.params);
    try {
        const user = await User.findById({ _id : req.params.id });
        if (!user) return res.status(404).send("User not found");
        res.status(200).send({user});
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// update user by id

router.patch('/users/:id', async (req, res) => {
    try {
        if (req.body.password) {
            req.body.password = await User.encryptPassword(req.body.password);
        }
        console.log(req.body)
        console.log(req.params.id)
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!user) return res.status(404).send("User Not found");
        res.status(200).send(user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});


// delete user by id

router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.removeUser(req.params.id);
        if (!user) return res.status(404).send("User Not found");

        res.status(200).send(user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// OTP Configuration

router.get('/users/:email/:otp', async (req, res) => {
    try {
        const email = req.params.email;
        const otp = req.params.otp;
        const user = await User.findOne({ email })
        if (!user) {
            res.status(404).send({ error: "User Not Regestered" })
        } else if (user.isGoogleAccount) {
            res.status(401).send({ error: "Google Account not Allowed" })
        } else {
            user.otp = await User.encryptPassword(otp);
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
            console.log("otp deletion started per minute")
            setInterval(User.deleteExpiredOtps, 60 * 1000);
            await user.save();
            res.status(200).send({ user });
        }
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

router.get('/users/:email/verify/:otp', async (req, res) => {
    try {
        const email = req.params.email;
        const otp = req.params.otp;
        const user = await User.findOne({ email });
        if (!user.otp) res.status(403).send("Otp Expired")
        const isMatch = await User.validateOtp(otp, user.otp);
        if (isMatch) {
            res.status(200).send({ user })
        } else {
            res.status(401).send('verification failed')
        }
    } catch (e) {
        res.status(500).send(e.message);
        console.log(e)
    }
});

module.exports = router;