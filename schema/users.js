const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        trim: true,
        required: true
    },
    middleName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    userName: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    phone: {
        type: String,
        trim: true,
        maxlength: 10,
        minlength: 10
    },
    password: {
        type: String,
    },
    otp: {
        type: String,
    },
    otpExpires: {
        type: Date,
    },
    isGoogleAccount: {
        type: Boolean,
        default: false,
    },
    tokens: [
        {
            token: {
                type: String,
            },
        }
    ],
    deviceTokens: [
        {
            deviceToken: {
                type: String,
            },
        }
    ],
    avatar: {
        type: Buffer,
    }
}, { timestamps: true });

userSchema.statics.findByCredential = async function (identifier, password) {
    const user = await this.findOne({
        $or: [{ email: identifier }, { userName: identifier }]
    });
    if (!user) throw new Error("User not found");
    if (user.isGoogleAccount) {
        return user;
    } else {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error("Invalid Credentials");
        return user;
    }
};

userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    // delete user.tokens;
    return user;
};

userSchema.methods.generateAuthToken = async function (deviceToken) {
    const user = this;
    const token = jwt.sign({ _id: user._id.toString() }, 'thisismyprivatekey');
    if (!user.deviceTokens.find(token => token.deviceToken === deviceToken)) {
        user.deviceTokens.push({ deviceToken });
    }
    user.tokens.push({ token });
    await user.save();
    return token;
};

userSchema.statics.removeUser = async function (id) {
    const user = await User.findByIdAndDelete(id)
    if (!user) throw new Error('User Not found : 404');
    // await Tasks.deleteMany({ owner: id });
    return user;
}

userSchema.statics.encryptPassword = async function (password) {
    return await bcrypt.hash(password, 8);
};

userSchema.statics.validateOtp = async function (otp, correctOtp) {
    return await bcrypt.compare(otp.toString(), correctOtp);
}

userSchema.statics.deleteExpiredOtps = async function () {
    const now = new Date();
    await User.updateMany(
        { otpExpires: { $lte: now } },
        { $unset: { otp: "", otpExpires: "" } }
    );
    console.log('Expired OTPs deleted');
}

userSchema.pre('save', async function (next) {
    const user = this;
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8);
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;