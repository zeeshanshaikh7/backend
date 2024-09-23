import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRETS,
});

const uploadOnCloudinary = async (filePath) => {
   try {
      if (!filePath) return null;
      const response = await cloudinary.uploader.upload(filePath, {
         resource_type: "auto",
      });
      fs.unlinkSync(filePath);
      return response;
   } catch (error) {
      fs.unlinkSync(filePath);
      return null;
   }
};

const deleteFromCloudinary = async (publicId) => {
   try {
      const result = await cloudinary.uploader.destroy(publicId)
      return result
   } catch (error) {
      return null
   }
};

export { uploadOnCloudinary,deleteFromCloudinary };
