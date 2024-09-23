import { asyncHandler } from "../utils/ayncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import {
   uploadOnCloudinary,
   deleteFromCloudinary,
} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userId) => {
   const user = await User.findById(userId);

   const accessToken = await user.generateAccessToken();
   const refreshToken = await user.generateRefreshToken();

   user.refreshToken = refreshToken;
   await user.save({ validateBeforeSave: false });

   return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
   // TODO:
   // get user details from frontend
   // validate if not empty
   // check if already user exist: username, email
   // check for image, check for avatar
   // upload them to cloudinary
   // create user object: create entry in db
   // remove password and refresh tokens
   // check for user creation
   // return response

   const { username, email, fullName, password } = req.body;

   if (
      [username, email, fullName, password].some(
         (fields) => fields?.trim() === ""
      )
   ) {
      throw new ApiError(400, "All fields are required");
   }

   const existedUser = await User.findOne({
      $or: [{ username }, { email }],
   });

   if (existedUser) {
      throw new ApiError(409, "User with email or username already exists");
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;

   let coverImageLocalPath;
   if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
   ) {
      coverImageLocalPath = req.files.coverImage[0].path;
   }

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required");
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if (!avatar) {
      throw new ApiError(400, "Avatar file is required");
   }

   const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
   });

   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   if (!createdUser) {
      throw new ApiError(
         500,
         "Something went wrong while registering the user"
      );
   }

   return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
   // TODO:
   // req body -> data
   // username or email
   // find the user
   // password check
   // access and referesh token
   // send cookie

   const { username, email, password } = req.body;
   if (!username && !email) {
      throw new ApiError(400, "username or email is required");
   }

   const user = await User.findOne({
      $or: [{ username }, { email }],
   });
   if (!user) {
      throw new ApiError(404, "user does not exist");
   }

   const isPasswordValid = await user.isPasswordCorrect(password);
   if (!isPasswordValid) {
      throw new ApiError(401, "Invalid user credentials");
   }

   const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);
   const logegdInUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );

   const options = {
      httpOnly: true,
      secure: true,
   };

   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               user: logegdInUser,
               accessToken,
               refreshToken,
            },
            "User logged in successfully"
         )
      );
});

const logoutUser = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $unset: { refreshToken: 1 },
      },
      { new: true }
      //NOTE: Return the updated document, if it was false it return document as it was before the update was made.
   );

   const options = {
      httpOnly: true,
      secure: true,
   };

   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
   // TODO:
   // get refresh token
   // compare with user's refresh token
   // create new if not matched

   const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

   if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized access");
   }

   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRETS
      );

      const user = await User.findById(decodedToken?._id);

      if (!user) {
         throw new ApiError(401, "Invalid refresh token");
      }

      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token expired or used");
      }

      const options = { httpOnly: true, secure: true };
      const { accessToken, refreshToken } =
         await generateAccessTokenAndRefreshToken(user._id);

      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", refreshToken, options)
         .json(
            new ApiResponse(
               200,
               {
                  accessToken,
                  refreshToken,
               },
               "access token refreshed"
            )
         );
   } catch (error) {
      throw new ApiError(401, "New access token refreshed");
   }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
   const { oldPassword, newPassword } = req.body;

   const user = await User.findById(req.user._id);

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
   if (!isPasswordCorrect) {
      throw new ApiError(401, "Invalid old password");
   }

   user.password = newPassword;
   await user.save({ validateBeforeSave: false });

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
   return res
      .status(200)
      .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
   const { fullName, email } = req.body;

   if (!fullName || !email) {
      throw new ApiError(401, "All fields are required");
   }

   const user = await User.findByIdAndUpdate(
      req.user._id,
      {
         $set: { fullName, email },
      },
      { new: true }
   ).select("-password");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
   const localFilePath = req?.file.path;

   if (!localFilePath) {
      throw new ApiError(401, "File is missing");
   }

   // TODO: delete old files
   const userAvtarUrl = await User.findById(req?.user._id).select("avatar");

   const publicId = extractPublicId(userAvtarUrl);
   const response = await deleteFromCloudinary(publicId);

   if (!response) {
      throw new ApiError(400, "Error while deleting old image");
   }

   const avatar = await uploadOnCloudinary(localFilePath);

   if (!avatar?.url) {
      throw new ApiError(400, "Error while uploading");
   }

   const user = await User.findByIdAndUpdate(
      req?.user._id,
      {
         $set: { avatar: avatar.url },
      },
      { new: true }
   ).select("-password");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Avatar changed successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
   const localFilePath = req?.file.path;

   if (!localFilePath) {
      throw new ApiError(401, "File is missing");
   }

   // TODO: delete old files
   const userCoverImageUrl = await User.findById(req?.user._id).select(
      "coverImage"
   );
   if (!userCoverImageUrl) {
      throw new ApiError(400, "Cover image is missing");
   }
   const publicId = extractPublicId(userCoverImageUrl);
   const response = await deleteFromCloudinary(publicId);

   if (!response) {
      throw new ApiError(400, "Error while deleting old image");
   }

   const coverImage = await uploadOnCloudinary(localFilePath);

   if (!coverImage?.url) {
      throw new ApiError(400, "Error while uploading");
   }

   const user = await User.findByIdAndUpdate(
      req?.user._id,
      {
         $set: { coverImage: coverImage.url },
      },
      { new: true }
   ).select("-password");

   return res
      .status(200)
      .json(new ApiResponse(200, user, "cover Image changed successfully"));
});


const getUserChannelProfile = 0;
const getWatchHistory = 0;

function extractPublicId(url) {
   // Remove the base URL and version part
   const parts = url.split("/");
   // Get the last part (file name with extension)
   const fileName = parts.pop();
   // Get the public ID without the file extension
   const publicId = fileName.split(".").slice(0, -1).join(".");

   return publicId;
}

export {
   registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getUserChannelProfile,
   getWatchHistory,
};
