import React from "react";
import mamtaCareLogo from "./assets/mamta-care-logo.jpeg";
import childrenArtwork from "./assets/children-day-art.webp";
import "./styles/children-day-welcome.css";

/**
 * Approved Children's Day greeting.
 * The artwork intentionally contains no brand mark or readable text.
 * The original Mamta Care logo is a separate, unmodified asset.
 */
export default function ChildrensDayWelcome({ registrationUrl, onDismiss, closeRef, contentRef }) {
  return (
    <>
      <button
        ref={closeRef}
        className="mcct-occasion-close mcct-child-close"
        type="button"
        onClick={onDismiss}
        aria-label="Close Children's Day greeting and continue to website"
      >×</button>
      <div className="mcct-child-layout">
        <figure className="mcct-child-art mcct-child-art--desktop" aria-hidden="true">
          <img src={childrenArtwork} alt="" />
        </figure>
        <div className="mcct-child-right">
          <div className="mcct-child-inner" ref={contentRef}>
            <img
              className="mcct-child-official-logo"
              src={mamtaCareLogo}
              alt="Official Mamta Care Charitable Trust logo"
            />
            <p className="mcct-child-date">14 NOVEMBER · CHILDREN'S DAY</p>
            <h1 id="mcct-occasion-title">Children's Day <em>Wishes</em></h1>
            <div className="mcct-child-heart" aria-hidden="true">♡</div>
            <p className="mcct-child-message" id="mcct-occasion-message">
              A day to celebrate every child's right to <strong>hope, courage, and care</strong>,
              especially those bravely fighting cancer.
            </p>
            <figure className="mcct-child-art mcct-child-art--mobile" aria-hidden="true">
              <img src={childrenArtwork} alt="" />
            </figure>
            <div className="mcct-child-actions">
              <button className="mcct-child-continue" type="button" onClick={onDismiss}>
                Continue to Website
              </button>
              <a className="mcct-child-register" href={registrationUrl} onClick={onDismiss}>
                Register to Donate Hair
              </a>
            </div>
            <p className="mcct-child-reminder">
              <span aria-hidden="true">✂</span>
              Minimum <strong>14 inches of usable hair</strong>, excluding split ends.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
