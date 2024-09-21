import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/ayncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, _, next) => {
   try {
      const token =
         req.cookies?.accessToken ||
         req.header("Authorization")?.replace("Bearer ", "");
      if (!token) {
         throw new ApiError(401, "Unauthorize request");
      }
      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRETS);
      const user = await User.findById(decodedToken?._id).select(
         "-password -accessToken"
      );
      if (!user) {
         throw new ApiError(401, "Invalid access token");
      }
      req.user = user;
      next();
   } catch (error) {
      throw new ApiError(401, error.message || "Invalid access token");
   }
});

export {verifyJWT};
