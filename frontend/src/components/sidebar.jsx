import React from "react";
import { Gamepad2, Bot, ChartNoAxesCombined, Settings, CircleHelp, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";

const PGSideBar = () => {
  return (
    <div className="m-1 mb-2 ms-2 me-4 rounded-xl p-4 px-0 bg--400 h-full flex flex-col gap-0 justify-between ">
      <div className="flex flex-col gap-1">
        <div className="font-semibold text-muted-foreground text-sm flex flex-row gap-2 items-center mb-5 ps-4 mt-1 mx-1">
          <Gamepad2 size={16} />
          <span>UPD-AI PLAYGROUND</span>
        </div>
        <div className="select-none text-foreground text-sm dark:bg-stone-700 bg-stone-300 hover:cursor-pointer h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md">
          <Bot size={16} className="text-sky-400" />
          Computer Vision
        </div>
        <div className="text-muted-foreground text-sm dark:hover:bg-stone-700 hover:bg-stone-300 hover:cursor-pointer h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md">
          <ChartNoAxesCombined size={16} />
          Performance Metrics
        </div>
      </div>
      <div className="flex flex-col">
        <div className="text-muted-foreground text-sm dark:hover:bg-stone-700 hover:bg-stone-300  hover:cursor-pointer h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md">
          <Settings size={16} />
          Settings
        </div>
        <div className="text-muted-foreground text-sm dark:hover:bg-stone-700 hover:bg-stone-300  hover:cursor-pointer h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md">
          <CircleHelp  size={16} />
          Help
        </div>
        <div className="text-muted-foreground text-sm dark:hover:bg-stone-700 hover:bg-stone-300  hover:cursor-pointer h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md">
          <Contact size={16} />
          Contact
        </div>
        <div className="text-stone-600 text-xs italic  h-8 w-full items-center flex gap-2 px-4 ms-1 me-4 rounded-md mt-3">
          Platform by Geyzson Kristoffer
        </div>
      </div>
    </div>
  );
};

export default PGSideBar;
