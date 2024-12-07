import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import image from "@/assets/images/pp.jpg";

const PGTopBar = () => {
  return (
    <div className="min-h-14 flex items-center px-4 justify-between text-sm">
      <div className="dark:text-stone-400 text-stone-800">
        Geyzson Kristoffer / UPD AI Program / AI 231 / ME / ME6 / Object
        Detection{" "}
      </div>
      <div className="">
        <Avatar className="my-1">
          <AvatarImage src={image} />
          <AvatarFallback>GK</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
};

export default PGTopBar;
