// Puts the theme and the motion mode back on <html> when React has cleared them.
// This work made by Anfinogentov Nikita
"use client";
import { useLayoutEffect } from "react";
import { applyPageState } from "@/lib/boot";

export function PageState() {
  // A page that calls notFound() or throws is rendered again in the browser, and React then wipes the attributes of <html> that the head
  // script set. There I set them again before the first paint, so a 404 keeps the chosen theme and the phone menu keeps its burger.
  useLayoutEffect(() => {
    applyPageState();
  }, []);
  return null;
}
