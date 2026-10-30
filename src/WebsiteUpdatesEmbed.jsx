import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import WebsiteUpdates from "./WebsiteUpdates";

/**
 * Non-invasive homepage insertion. App.jsx contains the existing sensitive
 * registration routing; preserve it exactly rather than rewriting that module.
 * Display administrator-published impact below the hero, never inside other
 * registration, donor tracking or wig pages.
 */
export default function WebsiteUpdatesEmbed() {
  const location = useLocation();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (location.pathname !== "/") {
      setTarget(null);
      return undefined;
    }
    let anchor = null;
    let observer = null;
    let created = false;
    const attach = () => {
      const hero = document.querySelector("section.cinematic-hero");
      if (!hero) return false;
      if (hero.nextElementSibling?.id === "mcct-weekly-website-anchor") {
        anchor = hero.nextElementSibling;
      } else {
        anchor = document.createElement("div");
        anchor.id = "mcct-weekly-website-anchor";
        anchor.setAttribute("data-purpose", "public-impact-content");
        hero.insertAdjacentElement("afterend", anchor);
        created = true;
      }
      setTarget(anchor);
      return true;
    };
    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer.disconnect();
      });
      const root = document.getElementById("root");
      if (root) observer.observe(root, { subtree: true, childList: true });
    }
    return () => {
      observer?.disconnect();
      if (created && anchor?.isConnected) anchor.remove();
    };
  }, [location.pathname]);

  if (location.pathname !== "/" || !target) return null;
  return createPortal(<WebsiteUpdates />, target);
}
