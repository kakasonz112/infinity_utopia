"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import BackButton from "../BackButton/BackButton";

export default function SiteHeader() {
  const pathname = usePathname();

  // Hide header on root
  if (pathname === "/") return null;

  return (
    <header className="siteHeader">
      <div className="siteHeaderLeft">
        <BackButton />
      </div>
        <div className="siteHeaderCenter" aria-hidden="true" >
            <div className="siteHeaderLogo">
                <a href="/">
                    <Image src="/infinity.png" alt="Infinity logo" width={96} height={36} priority />
                </a>
            </div>
        </div>
      <div className="siteHeaderRight" aria-hidden="true" />
    </header>
  );
}
