import { Router } from "express";
import {
   loginUser,
   logoutUser,
   refreshAccessToken,
   registerUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const route = Router();

route.route("/register").post(
   upload.fields([
      {
         name: "avatar",
         maxCount: 1,
      },
      {
         name: "coverImage",
         maxCount: 1,
      },
   ]),
   registerUser
);

route.route("/login").post(loginUser);
route.route("/logout").post(verifyJWT, logoutUser);
route.route("/refresh-token").post(refreshAccessToken);

export default route;
