"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
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
      <div className="siteHeaderCenter" aria-label="Infinity Kingdom home">
        <Link href="/" className="siteHeaderMark">
          <Image src="/infinity.png" alt="Infinity logo" width={96} height={36} priority />
          <div>
            <span className="siteHeaderTitle">Infinity Kingdom</span>
            <span className="siteHeaderSubtitle">Tools &amp; Utilities</span>
          </div>
        </Link>
      </div>
      <div className="siteHeaderRight" aria-hidden="true">
        {/* <span className="siteHeaderBadge">v2025</span> */}
      </div>
    </header>
  );
}
