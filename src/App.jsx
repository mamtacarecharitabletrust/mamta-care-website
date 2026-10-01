import React, { useRef, useState } from "react";

import {

  Routes,

  Route,

  Link,

  useLocation,

} from "react-router-dom";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

import mamtaCareLogo from "./assets/mamta-care-logo.jpeg";

import mamtaCareUpiQr from "./assets/mamta-care-upi-qr.jpeg";

import donorCertificateImage from "./assets/IMG-20260404-WA0005.jpg.jpeg";

import hairDonationReal from "./assets/IMG_20260709_142702.jpg.jpeg";

import wigSupportReal from "./assets/wig-support.png";

import humanitarianPhoto1 from "./assets/IMG-20260928-WA0013.jpg.jpeg";

import humanitarianPhoto2 from "./assets/IMG-20260928-WA0015.jpg.jpeg";

import mamtaCareTeam from "./assets/mamta-care-team.png";
import heroHairDonation from "./assets/hero-hair-donation.png";

/* =========================================================

   INFORMATION

========================================================= */

const info = {

  phone: "+91 8500012190",

  email: "bharthairseva.in@gmail.com",

  instagram:

    "https://www.instagram.com/hairdonationmamtacare.india/",

  hairDonationForm:

    "https://forms.gle/VpKSKJoichRqyTvH9",

  wigRequestForm:

    "https://forms.gle/dUsSyhYEC37SsRTe6",

  volunteerForm:

    "https://forms.gle/4vwkLPmG9MTKsv1x8",

  trackingApp:
    "https://script.google.com/macros/s/AKfycbxpjK80aue0-rvoVcCTvzrLBL1k3TvHaN0VtNTLC9KeSuy0RIfZnXoHKymnYj1Gbq8pBw/exec",

};

/* =========================================================

   WEBSITE VISUALS

========================================================= */

const visuals = {

  hero:
    heroHairDonation,

  hairDonation:

    hairDonationReal,

  wigSupport:

    wigSupportReal,

  humanitarian: [

    humanitarianPhoto1,

    humanitarianPhoto2,

  ],

  plantation:

    "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=2000&q=88",

  volunteer:

    humanitarianPhoto1,

};

/* =========================================================

   MOTION

========================================================= */

const ease = [0.16, 1, 0.3, 1];

const fadeUp = {

  hidden: {

    opacity: 0,

    y: 55,

  },

  visible: {

    opacity: 1,

    y: 0,

    transition: {

      duration: 0.9,

      ease,

    },

  },

};

const stagger = {

  hidden: {},

  visible: {

    transition: {

      staggerChildren: 0.13,

    },

  },

};

/* =========================================================

   REVEAL

========================================================= */

function Reveal({

  children,

  className = "",

  delay = 0,

}) {

  return (

    <motion.div

      className={className}

      initial={{

        opacity: 0,

        y: 45,

      }}

      whileInView={{

        opacity: 1,

        y: 0,

      }}

      viewport={{

        once: true,

        amount: 0.18,

      }}

      transition={{

        duration: 0.9,

        delay,

        ease,

      }}

    >

      {children}

    </motion.div>

  );

}

/* =========================================================

   LAYOUT

========================================================= */

function Layout({ children }) {

  const [menuOpen, setMenuOpen] = useState(false);

  const closeMobileMenu = () => setMenuOpen(false);

  return (

    <>

      <motion.header

        initial={{

          opacity: 0,

          y: -30,

        }}

        animate={{

          opacity: 1,

          y: 0,

        }}

        transition={{

          duration: 0.8,

          ease,

        }}

      >

        <div className="nav">

          <Link

            className="brand"

            to="/"

            aria-label="Mamta Care Charitable Trust Home"

            onClick={closeMobileMenu}

          >

            <img

              src={mamtaCareLogo}

              alt="Mamta Care Charitable Trust"

            />

          </Link>

          <button

            className={`mobile-menu-button ${menuOpen ? "is-open" : ""}`}

            type="button"

            onClick={() => setMenuOpen((open) => !open)}

            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}

            aria-expanded={menuOpen}

            aria-controls="primary-navigation"

          >

            <span />

            <span />

            <span />

          </button>

          <nav

            id="primary-navigation"

            className={`site-nav ${menuOpen ? "mobile-open" : ""}`}

            onClick={closeMobileMenu}

          >

            <Link to="/">

              Home

            </Link>

            <Link to="/about">

              About

            </Link>

            <Link to="/work">

              Our Work

            </Link>

            <a

              href={info.hairDonationForm}

              target="_blank"

              rel="noreferrer"

            >

              Donate Hair

            </a>

            <a

              href={info.wigRequestForm}

              target="_blank"

              rel="noreferrer"

            >

              Free Wig

            </a>

            <a

              className="mobile-only-track"

              href={info.trackingApp}

              target="_blank"

              rel="noreferrer"

            >

              Track Donation

            </a>

            <a

              href={info.volunteerForm}

              target="_blank"

              rel="noreferrer"

            >

              Volunteer

            </a>

            <Link to="/contact">

              Contact

            </Link>

            <Link

              className="donate"

              to="/donate"

            >

              Donate Now

            </Link>

          </nav>

        </div>

      </motion.header>

      <main>

        {children}

      </main>

      <footer>

        <div>

          <h3>

            MAMTA CARE CHARITABLE TRUST

          </h3>

          <p>

            Compassion • Dignity • Hope

          </p>

        </div>

        <div>

          <b>

            Contact

          </b>

          <p>

            {info.phone}

            <br />

            {info.email}

          </p>

        </div>

        <div>

          <b>

            Explore

          </b>

          <p>

            <Link to="/about">

              About Us

            </Link>

            <br />

            <Link to="/work">

              Our Work

            </Link>

            <br />

            <Link to="/go-green">

              Go Green

            </Link>

            <br />

            <Link to="/donate">

              Support Our Work

            </Link>

            <br />

            <a

              href={info.instagram}

              target="_blank"

              rel="noreferrer"

            >

              Instagram

            </a>

          </p>

        </div>

      </footer>

    </>

  );

}

/* =========================================================

   HOME

========================================================= */

function Home() {

  const heroRef = useRef(null);
  const storyRef = useRef(null);
  const greenRef = useRef(null);

  const heroMouseX = useMotionValue(0);
  const heroMouseY = useMotionValue(0);

  const smoothMouseX = useSpring(heroMouseX, {
    stiffness: 45,
    damping: 20,
  });

  const smoothMouseY = useSpring(heroMouseY, {
    stiffness: 45,
    damping: 20,
  });

  const heroRotateY = useTransform(
    smoothMouseX,
    [-30, 30],
    [-1.8, 1.8]
  );

  const heroRotateX = useTransform(
    smoothMouseY,
    [-22, 22],
    [1.2, -1.2]
  );

  function handleHeroMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();

    const x =
      event.clientX -
      rect.left -
      rect.width / 2;

    const y =
      event.clientY -
      rect.top -
      rect.height / 2;

    heroMouseX.set((x / rect.width) * 45);
    heroMouseY.set((y / rect.height) * 32);
  }

  function handleHeroMouseLeave() {
    heroMouseX.set(0);
    heroMouseY.set(0);
  }

  const {

    scrollYProgress: heroScroll,

  } = useScroll({

    target: heroRef,

    offset: [

      "start start",

      "end start",

    ],

  });

  const {

    scrollYProgress: storyScroll,

  } = useScroll({

    target: storyRef,

    offset: [

      "start end",

      "end start",

    ],

  });

  const {

    scrollYProgress: greenScroll,

  } = useScroll({

    target: greenRef,

    offset: [

      "start end",

      "end start",

    ],

  });

  const heroBackgroundY =

    useTransform(

      heroScroll,

      [0, 1],

      ["0%", "18%"]

    );

  const heroBackgroundScale =

    useTransform(

      heroScroll,

      [0, 1],

      [1.06, 1.22]

    );

  const heroTextY =

    useTransform(

      heroScroll,

      [0, 1],

      [0, 150]

    );

  const heroTextOpacity =

    useTransform(

      heroScroll,

      [0, 0.72],

      [1, 0]

    );

  const heroForegroundY =

    useTransform(

      heroScroll,

      [0, 1],

      [0, -100]

    );

  const storyImageScale =

    useTransform(

      storyScroll,

      [0, 0.5, 1],

      [0.94, 1, 1.04]

    );

  const storyImageY =

    useTransform(

      storyScroll,

      [0, 1],

      [70, -55]

    );

  const greenBackgroundY =

    useTransform(

      greenScroll,

      [0, 1],

      ["-8%", "12%"]

    );

  return (

    <>
      {/* =====================================================
          PREMIUM 3D HERO
      ====================================================== */}

      <section
        ref={heroRef}
        className="cinematic-hero"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
      >
        <motion.div
          className="cinematic-hero-bg-wrap"
          style={{
            y: heroBackgroundY,
            scale: heroBackgroundScale,
          }}
        >
          <motion.div
            className="cinematic-hero-bg"
            style={{
              backgroundImage: `url(${visuals.hero})`,
              x: smoothMouseX,
              y: smoothMouseY,
              rotateX: heroRotateX,
              rotateY: heroRotateY,
            }}
          />
        </motion.div>

        <div className="cinematic-hero-shade" />
        <div className="cinematic-hero-glow" />
        <div className="hero-depth-vignette" />

        <motion.div
          className="hero-glass-orbit"
          animate={{ rotate: [0, 360] }}
          transition={{
            duration: 32,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        <motion.div
          className="hero-orb hero-orb-one"
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="hero-orb hero-orb-two"
          animate={{
            y: [0, 25, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        <motion.div
          className="cinematic-hero-inner"
          style={{
            y: heroTextY,
            opacity: heroTextOpacity,
          }}
        >
          <motion.div
            className="hero-copy"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.p
              className="eyebrow hero-eyebrow"
              variants={fadeUp}
            >
              MAMTA CARE CHARITABLE TRUST
            </motion.p>

            <motion.h1 variants={fadeUp}>
              Donate Hair.
              <span>Give Hope.</span>
            </motion.h1>

            <motion.p
              className="hero-intro"
              variants={fadeUp}
            >
              A simple haircut can become confidence, dignity and hope
              for someone experiencing hair loss during cancer treatment.
            </motion.p>

            <motion.div
              className="hero-actions hero-actions-premium"
              variants={fadeUp}
            >
              <motion.a
                className="btn hero-primary"
                href={info.hairDonationForm}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -5, scale: 1.025 }}
                whileTap={{ scale: 0.98 }}
              >
                Donate Your Hair
                <span>↗</span>
              </motion.a>

              <motion.a
                className="btn hero-secondary"
                href={info.wigRequestForm}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -5 }}
              >
                Request a Free Wig
              </motion.a>

              <motion.a
                className="btn hero-track-btn"
                href={info.trackingApp}
                target="_blank"
                rel="noreferrer"
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="track-pulse" />
                Track Your Hair Donation
                <span className="track-arrow">↗</span>
              </motion.a>
            </motion.div>

            <motion.div
              className="hero-proof"
              variants={fadeUp}
            >
              <div>
                <span>01</span>
                <p>Donate Hair</p>
              </div>

              <div>
                <span>02</span>
                <p>Restore Confidence</p>
              </div>

              <div>
                <span>03</span>
                <p>Track Your Donation</p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-side-message"
          style={{ y: heroForegroundY }}
        >
          <span>01</span>

          <p>
            Compassion
            <br />
            in action
          </p>
        </motion.div>

        <motion.div
          className="scroll-indicator"
          animate={{ y: [0, 10, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          <span>Scroll to discover</span>
          <div className="scroll-line" />
        </motion.div>
      </section>

{/* =====================================================

          INTRO STATEMENT

      ====================================================== */}

      <section className="statement-section">

        <Reveal className="statement-inner">

          <p className="eyebrow">

            A SMALL ACT. A REAL DIFFERENCE.

          </p>

          <h2>

            What feels ordinary to

            one person can become{" "}

            <span>

              extraordinary hope

            </span>{" "}

            for another.

          </h2>

          <p className="statement-copy">

            Mamta Care brings

            compassionate action,

            community participation,

            hair donation awareness,

            free wig support and

            humanitarian initiatives

            together with one purpose:

            helping people feel seen,

            supported and cared for.

          </p>

        </Reveal>

      </section>

      {/* =====================================================

          REAL DONOR STORY

      ====================================================== */}

      <section

        ref={storyRef}

        className="story-section"

      >

        <div className="story-grid">

          <motion.div

            className="story-image-wrap donor-story-wrap"

            style={{

              y: storyImageY,

            }}

            initial={{

              opacity: 0,

              x: -70,

              rotateY: -6,

            }}

            whileInView={{

              opacity: 1,

              x: 0,

              rotateY: 0,

            }}

            viewport={{

              once: true,

              amount: 0.18,

            }}

            transition={{

              duration: 1.1,

              ease,

            }}

          >

            <motion.div

              className="donor-premium-frame"

              style={{

                scale:

                  storyImageScale,

              }}

              whileHover={{

                rotateY: 2,

                rotateX: -1.5,

                scale: 1.015,

              }}

              transition={{

                duration: 0.45,

              }}

            >

              <div className="donor-frame-glow" />

              <img

                src={donorCertificateImage}

                alt="Mamta Care hair donor holding donated hair and certificate of appreciation"

                className="donor-story-image"

              />

              <motion.div

                className="donor-logo-badge"

                initial={{

                  opacity: 0,

                  y: -20,

                }}

                whileInView={{

                  opacity: 1,

                  y: 0,

                }}

                viewport={{

                  once: true,

                }}

                transition={{

                  delay: 0.5,

                  duration: 0.7,

                }}

              >

                <img

                  src={mamtaCareLogo}

                  alt="Mamta Care Charitable Trust"

                />

              </motion.div>

              <motion.div

                className="donor-photo-caption"

                initial={{

                  opacity: 0,

                  y: 30,

                }}

                whileInView={{

                  opacity: 1,

                  y: 0,

                }}

                viewport={{

                  once: true,

                }}

                transition={{

                  delay: 0.45,

                  duration: 0.8,

                  ease,

                }}

              >

                <span className="donor-caption-number">

                  01

                </span>

                <div>

                  <strong>

                    A Real Act of Hope

                  </strong>

                  <small>

                    Hair Donation • Mamta Care

                  </small>

                </div>

              </motion.div>

            </motion.div>

          </motion.div>

          <motion.div

            className="story-copy"

            initial="hidden"

            whileInView="visible"

            viewport={{

              once: true,

              amount: 0.3,

            }}

            variants={stagger}

          >

            <motion.p

              className="eyebrow"

              variants={fadeUp}

            >

              WHY HAIR DONATION MATTERS

            </motion.p>

            <motion.h2

              variants={fadeUp}

            >

              Don't waste the hair.

              <br />

              <span>

                Let it become hope.

              </span>

            </motion.h2>

            <motion.p

              variants={fadeUp}

            >

              Hair that might otherwise

              be discarded can become

              part of something much

              more meaningful. A simple

              decision to donate can

              support people

              experiencing hair loss

              during cancer treatment

              and help restore dignity,

              confidence and hope.

            </motion.p>

            <motion.div

              className="story-message"

              variants={fadeUp}

            >

              <span>

                “

              </span>

              <p>

                This is dignity.

                <br />

                This is confidence.

                <br />

                <strong>

                  This is hope.

                </strong>

              </p>

            </motion.div>

            <motion.a

              variants={fadeUp}

              className="text-link"

              href={

                info.hairDonationForm

              }

              target="_blank"

              rel="noreferrer"

              whileHover={{

                x: 7,

              }}

            >

              Begin your hair donation

              <span>

                ↗

              </span>

            </motion.a>

          </motion.div>

        </div>

      </section>

      {/* =====================================================

          OUR WORK

      ====================================================== */}

      <section className="impact-section">

        <Reveal className="impact-heading">

          <p className="eyebrow">

            OUR WORK

          </p>

          <h2>

            Different acts.

            <br />

            One human purpose.

          </h2>

        </Reveal>

        <div className="impact-grid">

          <ImpactCard

            number="01"

            title="Hair Donation"

            description="Transforming a haircut into a meaningful act of compassion."

            image={

              visuals.hairDonation

            }

            link={

              info.hairDonationForm

            }

          />

          <ImpactCard

            number="02"

            title="Free Wig Support"

            description="Supporting people experiencing treatment-related hair loss with dignity and care."

            image={

              visuals.wigSupport

            }

            link={

              info.wigRequestForm

            }

          />

          <ImpactCard

            number="03"

            title="Humanitarian Care"

            description="Extending compassionate support to people and communities during difficult circumstances."

            images={

              visuals.humanitarian

            }

            to="/work"

          />

          <ImpactCard

            number="04"

            title="Go Green"

            description="Encouraging tree plantation, environmental awareness and community participation."

            image={

              visuals.plantation

            }

            to="/go-green"

          />

        </div>

      </section>

      {/* =====================================================

          FREE WIG SECTION

      ====================================================== */}

      <section className="wig-experience">

        <motion.div

          className="wig-experience-image"

          initial={{

            scale: 1.12,

          }}

          whileInView={{

            scale: 1,

          }}

          viewport={{

            once: true,

            amount: 0.3,

          }}

          transition={{

            duration: 1.5,

            ease,

          }}

          style={{

            backgroundImage:

              `url(${visuals.wigSupport})`,

          }}

        />

        <div className="wig-experience-overlay" />

        <motion.div

          className="wig-experience-content"

          initial={{

            opacity: 0,

            y: 70,

          }}

          whileInView={{

            opacity: 1,

            y: 0,

          }}

          viewport={{

            once: true,

            amount: 0.4,

          }}

          transition={{

            duration: 1,

            ease,

          }}

        >

          <p className="eyebrow">

            FREE WIG SUPPORT

          </p>

          <h2>

            Confidence

            <br />

            matters.

          </h2>

          <p>

            Our free wig initiative

            aims to help people

            experiencing hair loss

            during cancer treatment

            feel confident,

            comfortable and cared for.

          </p>

          <a

            className="btn hero-primary"

            href={

              info.wigRequestForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Request a Free Wig

            <span>

              ↗

            </span>

          </a>

        </motion.div>

      </section>

      {/* =====================================================

          GO GREEN

      ====================================================== */}

      <section

        ref={greenRef}

        className="green-experience"

      >

        <motion.div

          className="green-background"

          style={{

            backgroundImage:

              `url(${visuals.plantation})`,

            y:

              greenBackgroundY,

          }}

        />

        <div className="green-overlay" />

        <div className="green-content">

          <motion.div

            initial={{

              opacity: 0,

              x: -70,

            }}

            whileInView={{

              opacity: 1,

              x: 0,

            }}

            viewport={{

              once: true,

              amount: 0.3,

            }}

            transition={{

              duration: 1,

              ease,

            }}

          >

            <p className="eyebrow">

              GO GREEN CHALLENGE

            </p>

            <h2>

              Plant one.

              <br />

              Inspire many.

            </h2>

            <p>

              A greener community can

              begin with one simple

              action. Plant a tree,

              capture the moment,

              share it and encourage

              another person to do the

              same.

            </p>

          </motion.div>

          <motion.div

            className="green-steps"

            initial="hidden"

            whileInView="visible"

            viewport={{

              once: true,

              amount: 0.25,

            }}

            variants={stagger}

          >

            {[

              "Plant",

              "Photograph",

              "Share",

              "Inspire",

            ].map(

              (

                item,

                index

              ) => (

                <motion.div

                  key={item}

                  variants={fadeUp}

                >

                  <span>

                    0{index + 1}

                  </span>

                  <strong>

                    {item}

                  </strong>

                </motion.div>

              )

            )}

          </motion.div>

        </div>

      </section>

      {/* =====================================================

          COMMUNITY

      ====================================================== */}

      <section className="community-section">

        <div className="community-inner">

          <motion.div

            className="community-copy"

            initial="hidden"

            whileInView="visible"

            viewport={{

              once: true,

              amount: 0.25,

            }}

            variants={stagger}

          >

            <motion.p

              className="eyebrow"

              variants={fadeUp}

            >

              PEOPLE MAKE CHANGE POSSIBLE

            </motion.p>

            <motion.h2

              variants={fadeUp}

            >

              Compassion grows when

              people come together.

            </motion.h2>

            <motion.p

              variants={fadeUp}

            >

              Whether you donate hair,

              volunteer your time,

              support an initiative or

              simply help spread

              awareness, every action

              can contribute to

              something meaningful.

            </motion.p>

            <motion.a

              variants={fadeUp}

              className="btn primary"

              href={

                info.volunteerForm

              }

              target="_blank"

              rel="noreferrer"

            >

              Become a Volunteer

            </motion.a>

          </motion.div>

          <motion.div

            className="community-collage"

            initial={{

              opacity: 0,

              scale: 0.9,

            }}

            whileInView={{

              opacity: 1,

              scale: 1,

            }}

            viewport={{

              once: true,

              amount: 0.25,

            }}

            transition={{

              duration: 1,

              ease,

            }}

          >

            {/* LARGE PHOTO — unchanged */}

            <div

              className="collage-image collage-main"

              style={{

                backgroundImage:

                  `url(${humanitarianPhoto1})`,

              }}

            />

            {/* SMALL PHOTO — replaced with new Mamta Care team image */}

            <div

              className="collage-image collage-small"

              style={{

                backgroundImage:

                  `url(${mamtaCareTeam})`,

              }}

            />

            <motion.div

              className="community-badge"

              animate={{

                y: [

                  0,

                  -10,

                  0,

                ],

              }}

              transition={{

                duration: 4,

                repeat: Infinity,

              }}

            >

              <strong>

                Care

              </strong>

              <span>

                with purpose

              </span>

            </motion.div>

          </motion.div>

        </div>

      </section>

      {/* =====================================================

          FINAL CTA

      ====================================================== */}

      <section className="final-cta">

        <motion.div

          initial={{

            opacity: 0,

            y: 60,

          }}

          whileInView={{

            opacity: 1,

            y: 0,

          }}

          viewport={{

            once: true,

            amount: 0.35,

          }}

          transition={{

            duration: 1,

            ease,

          }}

        >

          <p className="eyebrow">

            ONE DECISION CAN CREATE HOPE

          </p>

          <h2>

            Your next haircut

            could mean something

            more.

          </h2>

          <div className="final-actions">

            <a

              className="btn hero-primary"

              href={

                info.hairDonationForm

              }

              target="_blank"

              rel="noreferrer"

            >

              Donate Your Hair

            </a>

            <Link

              className="btn hero-secondary-dark"

              to="/about"

            >

              Discover Our Story

            </Link>

          </div>

        </motion.div>

      </section>

    </>

  );

}

/* =========================================================

   IMPACT CARD

========================================================= */

function ImpactCard({

  number,

  title,

  description,

  image,

  images,

  link,

  to,

}) {

  const media = images?.length ? (

    <div className="impact-card-collage">

      {images.map(

        (src, index) => (

          <div

            key={`${title}-${index}`}

            className="impact-card-collage-image"

            style={{

              backgroundImage:

                `url(${src})`,

            }}

          />

        )

      )}

    </div>

  ) : (

    <div

      className="impact-card-image"

      style={{

        backgroundImage:

          `url(${image})`,

      }}

    />

  );

  const content = (

    <>

      {media}

      <div className="impact-card-shade" />

      <div className="impact-card-content">

        <span className="impact-number">

          {number}

        </span>

        <div>

          <h3>

            {title}

          </h3>

          <p>

            {description}

          </p>

          <span className="impact-arrow">

            ↗

          </span>

        </div>

      </div>

    </>

  );

  if (link) {

    return (

      <motion.a

        href={link}

        target="_blank"

        rel="noreferrer"

        className="impact-card"

        initial={{

          opacity: 0,

          y: 70,

        }}

        whileInView={{

          opacity: 1,

          y: 0,

        }}

        viewport={{

          once: true,

          amount: 0.25,

        }}

        whileHover={{

          y: -10,

        }}

        transition={{

          duration: 0.8,

          ease,

        }}

      >

        {content}

      </motion.a>

    );

  }

  return (

    <motion.div

      className="impact-card"

      initial={{

        opacity: 0,

        y: 70,

      }}

      whileInView={{

        opacity: 1,

        y: 0,

      }}

      viewport={{

        once: true,

        amount: 0.25,

      }}

      whileHover={{

        y: -10,

      }}

      transition={{

        duration: 0.8,

        ease,

      }}

    >

      <Link

        to={to}

        className="impact-card-link"

      >

        {content}

      </Link>

    </motion.div>

  );

}

/* =========================================================

   NORMAL CARD

========================================================= */

function Card({

  number,

  t,

  d,

}) {

  return (

    <motion.article

      className="card"

      variants={fadeUp}

      whileHover={{

        y: -10,

      }}

    >

      <div className="card-number">

        {number}

      </div>

      <div className="icon">

        ♡

      </div>

      <h3>

        {t}

      </h3>

      <p>

        {d}

      </p>

    </motion.article>

  );

}

/* =========================================================

   PAGE

========================================================= */

function Page({

  title,

  intro,

  children,

}) {

  return (

    <motion.section

      className="page"

      initial={{

        opacity: 0,

      }}

      animate={{

        opacity: 1,

      }}

      transition={{

        duration: 0.4,

      }}

    >

      <motion.div

        className="section-head page-heading"

        initial={{

          opacity: 0,

          y: 45,

        }}

        animate={{

          opacity: 1,

          y: 0,

        }}

        transition={{

          duration: 0.9,

          ease,

        }}

      >

        <p className="eyebrow">

          MAMTA CARE CHARITABLE TRUST

        </p>

        <h1>

          {title}

        </h1>

        <p>

          {intro}

        </p>

      </motion.div>

      {children}

    </motion.section>

  );

}

/* =========================================================

   ABOUT

========================================================= */

function About() {

  return (

    <Page

      title="About MAMTA CARE CHARITABLE TRUST"

      intro="A compassionate organization committed to creating meaningful support, protecting dignity and bringing hope through practical humanitarian initiatives."

    >

      <section className="about-intro">

        <Reveal className="about-story">

          <p className="eyebrow">

            WHO WE ARE

          </p>

          <h2>

            Compassion That Becomes Action

          </h2>

          <p>

            MAMTA CARE CHARITABLE TRUST

            is committed to supporting

            people who need care,

            assistance and compassion.

          </p>

          <p>

            Our work brings together

            healthcare support,

            humanitarian initiatives,

            free wigs for cancer

            patients, hair donation

            awareness and environmental

            participation.

          </p>

        </Reveal>

        <Reveal className="about-values">

          <div>

            <span>

              01

            </span>

            <h3>

              Compassion

            </h3>

            <p>

              Listening, caring and

              treating people with

              dignity.

            </p>

          </div>

          <div>

            <span>

              02

            </span>

            <h3>

              Support

            </h3>

            <p>

              Turning kindness into

              practical assistance.

            </p>

          </div>

          <div>

            <span>

              03

            </span>

            <h3>

              Hope

            </h3>

            <p>

              Helping people feel

              confident and cared for.

            </p>

          </div>

        </Reveal>

      </section>

      <section className="mission-vision">

        <Reveal className="mission-box">

          <p className="eyebrow">

            OUR MISSION

          </p>

          <h2>

            Care That Creates Hope

          </h2>

          <p>

            To provide compassionate

            support through healthcare

            assistance, humanitarian

            initiatives and our free

            wig initiative while

            encouraging meaningful

            acts of kindness.

          </p>

        </Reveal>

        <Reveal className="vision-box">

          <p className="eyebrow">

            OUR VISION

          </p>

          <h2>

            A More Caring Community

          </h2>

          <p>

            To encourage a culture

            where people come together

            to support one another,

            protect dignity, create

            hope and contribute

            positively to communities

            and the environment.

          </p>

        </Reveal>

      </section>

      <section>

        <div className="section-head">

          <p className="eyebrow">

            WHAT GUIDES US

          </p>

          <h2>

            Our Values

          </h2>

        </div>

        <motion.div

          className="cards"

          initial="hidden"

          whileInView="visible"

          viewport={{

            once: true,

          }}

          variants={stagger}

        >

          <Card

            number="01"

            t="Dignity"

            d="Every person deserves respect and care."

          />

          <Card

            number="02"

            t="Compassion"

            d="We value kindness, empathy and human connection."

          />

          <Card

            number="03"

            t="Community"

            d="We encourage people to contribute toward meaningful change."

          />

          <Card

            number="04"

            t="Action"

            d="Small acts can create meaningful positive impact."

          />

        </motion.div>

      </section>

      <section className="leadership-section">

        <div className="section-head">

          <p className="eyebrow">

            OUR LEADERSHIP

          </p>

          <h2>

            People Behind the Mission

          </h2>

        </div>

        <div className="leadership-grid">

          <PersonCard

            initials="MT"

            name="MAMTA THAKUR"

            role="Founder"

          />

          <PersonCard

            initials="AT"

            name="ANIRUDH MUKUND THAKUR"

            role="Secretary"

          />

          <PersonCard

            initials="GS"

            name="GNANESWAR SAI"

            role="Administrator"

          />

        </div>

      </section>

      <section className="reach-section">

        <div>

          <p className="eyebrow">

            OUR REACH

          </p>

          <h2>

            Connecting People Through Compassion

          </h2>

          <p>

            We support people and

            connect with supporters

            across India and

            internationally.

          </p>

        </div>

        <div className="reach-list">

          {[

            "India",

            "UK",

            "USA",

            "New Zealand",

            "Canada",

            "UAE",

            "Australia",

            "Singapore",

          ].map(

            (country) => (

              <span key={country}>

                {country}

              </span>

            )

          )}

        </div>

      </section>

    </Page>

  );

}

/* =========================================================

   PERSON CARD

========================================================= */

function PersonCard({

  initials,

  name,

  role,

}) {

  return (

    <motion.div

      className="person-card"

      initial={{

        opacity: 0,

        y: 40,

      }}

      whileInView={{

        opacity: 1,

        y: 0,

      }}

      viewport={{

        once: true,

      }}

      whileHover={{

        y: -8,

      }}

    >

      <div className="person-avatar">

        {initials}

      </div>

      <h3>

        {name}

      </h3>

      <span>

        {role}

      </span>

    </motion.div>

  );

}

/* =========================================================

   WORK

========================================================= */

function Work() {

  return (

    <Page

      title="Creating Support. Sharing Hope."

      intro="Our work focuses on practical support, dignity and compassionate community action."

    >

      <motion.div

        className="cards"

        initial="hidden"

        whileInView="visible"

        viewport={{

          once: true,

        }}

        variants={stagger}

      >

        <Card

          number="01"

          t="Healthcare & Medical Support"

          d="Supporting people and families with healthcare-related needs."

        />

        <Card

          number="02"

          t="Free Wigs for Cancer Patients"

          d="Providing wigs free of cost to people experiencing hair loss."

        />

        <Card

          number="03"

          t="Community & Humanitarian Support"

          d="Extending compassionate assistance to people facing challenging circumstances."

        />

        <Card

          number="04"

          t="Go Green Challenge"

          d="Encouraging tree plantation and community participation."

        />

        <Card

          number="05"

          t="Volunteer With Us"

          d="Welcoming people who want to contribute their time and skills."

        />

      </motion.div>

      <AnimatedHighlight>

        <div>

          <p className="eyebrow">

            GO GREEN CHALLENGE

          </p>

          <h2>

            Plant a Tree.

            <br />

            Share the Hope.

          </h2>

          <p>

            Plant, photograph, share

            and inspire others.

          </p>

          <Link

            className="btn hero-primary"

            to="/go-green"

          >

            Explore Go Green

          </Link>

        </div>

      </AnimatedHighlight>

      <AnimatedHighlight>

        <div>

          <p className="eyebrow">

            VOLUNTEER WITH US

          </p>

          <h2>

            Become a Volunteer

          </h2>

          <p>

            Join our volunteer

            community and contribute

            your skills, time and

            support.

          </p>

          <a

            className="btn primary"

            href={

              info.volunteerForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Volunteer Registration

          </a>

        </div>

      </AnimatedHighlight>

    </Page>

  );

}

/* =========================================================

   GO GREEN PAGE

========================================================= */

function GoGreen() {

  return (

    <>

      <section className="go-green-page-hero">

        <motion.div

          className="go-green-page-bg"

          style={{

            backgroundImage:

              `url(${visuals.plantation})`,

          }}

          initial={{

            scale: 1.12,

          }}

          animate={{

            scale: 1,

          }}

          transition={{

            duration: 1.6,

            ease,

          }}

        />

        <div className="go-green-page-overlay" />

        <motion.div

          className="go-green-page-content"

          initial={{

            opacity: 0,

            y: 60,

          }}

          animate={{

            opacity: 1,

            y: 0,

          }}

          transition={{

            duration: 1,

            ease,

          }}

        >

          <p className="eyebrow">

            MAMTA CARE • GO GREEN

          </p>

          <h1>

            Plant Today.

            <br />

            <span>

              Protect Tomorrow.

            </span>

          </h1>

          <p>

            Our Go Green initiative

            encourages people and

            communities to plant trees,

            care for the environment

            and inspire others through

            meaningful action.

          </p>

        </motion.div>

      </section>

      <section className="go-green-gallery-section">

        <Reveal className="section-head">

          <p className="eyebrow">

            GO GREEN ACTIVITIES

          </p>

          <h2>

            Growing change together.

          </h2>

          <p>

            Plantation activity photographs

            from Mamta Care will be displayed

            here.

          </p>

        </Reveal>

        <div className="go-green-placeholder">

          <span>

            Plantation photo gallery

          </span>

          <p>

            The page is ready. Your real

            plantation photographs can now

            be added here.

          </p>

        </div>

      </section>

    </>

  );

}

/* =========================================================

   ANIMATED HIGHLIGHT

========================================================= */

function AnimatedHighlight({

  children,

}) {

  return (

    <motion.div

      className="highlight small"

      initial={{

        opacity: 0,

        y: 50,

      }}

      whileInView={{

        opacity: 1,

        y: 0,

      }}

      viewport={{

        once: true,

        amount: 0.2,

      }}

      transition={{

        duration: 0.9,

        ease,

      }}

    >

      {children}

    </motion.div>

  );

}

/* =========================================================

   VOLUNTEER

========================================================= */

function Volunteer() {

  return (

    <Page

      title="Become a Volunteer"

      intro="Your time, skills and compassion can help us create meaningful support for people and communities."

    >

      <AnimatedHighlight>

        <div>

          <p className="eyebrow">

            VOLUNTEER REGISTRATION

          </p>

          <h2>

            Be a Part of the Change

          </h2>

          <p>

            We welcome people who

            would like to contribute

            their time, skills and

            support to our

            initiatives.

          </p>

          <a

            className="btn primary"

            href={

              info.volunteerForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Open Volunteer Form

          </a>

        </div>

      </AnimatedHighlight>

    </Page>

  );

}

/* =========================================================

   DONATE

========================================================= */

function Donate() {

  return (

    <Page

      title="Support Our Work"

      intro="Your support can help MAMTA CARE CHARITABLE TRUST continue its humanitarian and healthcare initiatives."

    >

      <motion.div

        className="donation"

        initial={{

          opacity: 0,

          y: 50,

        }}

        whileInView={{

          opacity: 1,

          y: 0,

        }}

        viewport={{

          once: true,

        }}

      >

        <div className="qr">

          <img

            src={mamtaCareUpiQr}

            alt="Mamta Care Charitable Trust UPI QR Code"

          />

        </div>

        <div>

          <p className="eyebrow">

            DIRECT SUPPORT

          </p>

          <h2>

            Donate via UPI

          </h2>

          <ol>

            <li>

              Open your preferred UPI app.

            </li>

            <li>

              Scan the QR code.

            </li>

            <li>

              Enter your amount.

            </li>

            <li>

              Complete the payment.

            </li>

          </ol>

          <p>

            <b>

              Phone:

            </b>{" "}

            {info.phone}

            <br />

            <b>

              Email:

            </b>{" "}

            {info.email}

          </p>

        </div>

      </motion.div>

      <AnimatedHighlight>

        <div>

          <h2>

            Can't Donate Money?

            <br />

            Donate Your Hair.

          </h2>

          <p>

            Your hair can become a

            meaningful gift of hope.

          </p>

          <a

            className="btn primary"

            href={

              info.hairDonationForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Donate Your Hair

          </a>

        </div>

      </AnimatedHighlight>

    </Page>

  );

}

/* =========================================================

   CONTACT

========================================================= */

function Contact() {

  function handleSubmit(event) {

    event.preventDefault();

    alert(

      "Thank you. Your message has been recorded in this demo. The website backend will be connected later."

    );

  }

  return (

    <Page

      title="Contact Us"

      intro="Whether you want to donate hair, request a free wig, volunteer, support our work or learn more, please get in touch."

    >

      <div className="contact-grid">

        <Reveal>

          <div className="contact-info">

            <p className="eyebrow">

              GET IN TOUCH

            </p>

            <h3>

              Visit / Write to Us

            </h3>

            <p>

              Mamata Care Charitable Trust

              <br />

              Plot No. 5, Shankar Chavan Mala,

              <br />

              2nd Right Lane, Behind Kadam Dairy,

              <br />

              Jai Bhavani Road, Nashik Road,

              <br />

              Nashik – 422001,

              Maharashtra, India.

            </p>

            <p>

              <a href="tel:+918500012190">

                {info.phone}

              </a>

              <br />

              <a

                href={`mailto:${info.email}`}

              >

                {info.email}

              </a>

            </p>

            <a

              href={info.instagram}

              target="_blank"

              rel="noreferrer"

            >

              Instagram ↗

            </a>

          </div>

        </Reveal>

        <motion.form

          onSubmit={handleSubmit}

          initial={{

            opacity: 0,

            y: 45,

          }}

          whileInView={{

            opacity: 1,

            y: 0,

          }}

          viewport={{

            once: true,

          }}

        >

          <label>

            Full Name *

            <input required />

          </label>

          <label>

            Mobile Number *

            <input required />

          </label>

          <label>

            Email Address

            <input

              type="email"

            />

          </label>

          <label>

            Reason for Contact

            <select>

              <option>

                Hair Donation

              </option>

              <option>

                Free Wig Request

              </option>

              <option>

                Donation / Support

              </option>

              <option>

                Go Green Challenge

              </option>

              <option>

                Volunteering

              </option>

              <option>

                General Enquiry

              </option>

            </select>

          </label>

          <label>

            Message *

            <textarea

              required

              rows="6"

            />

          </label>

          <button

            className="btn primary"

            type="submit"

          >

            Send Message

          </button>

        </motion.form>

      </div>

    </Page>

  );

}

/* =========================================================

   HAIR DONATION PAGE

========================================================= */

function HairDonation() {

  return (

    <Page

      title="Donate Your Hair"

      intro="Your hair can become a meaningful gift of confidence and hope."

    >

      <AnimatedHighlight>

        <div>

          <p className="eyebrow">

            HAIR DONATION

          </p>

          <h2>

            Turn a Haircut Into Hope.

          </h2>

          <p>

            Register your hair donation

            with Mamta Care Charitable

            Trust and our team will guide

            you through the process.

          </p>

          <a

            className="btn primary"

            href={

              info.hairDonationForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Register Hair Donation

          </a>

        </div>

      </AnimatedHighlight>

    </Page>

  );

}

/* =========================================================

   WIG REQUEST PAGE

========================================================= */

function WigRequest() {

  return (

    <Page

      title="Request a Free Wig"

      intro="Our free wig initiative supports people experiencing hair loss during cancer treatment."

    >

      <AnimatedHighlight>

        <div>

          <p className="eyebrow">

            FREE WIG SUPPORT

          </p>

          <h2>

            Confidence Matters.

          </h2>

          <p>

            Submit the official wig

            request form and connect

            with Mamta Care Charitable

            Trust for support.

          </p>

          <a

            className="btn primary"

            href={

              info.wigRequestForm

            }

            target="_blank"

            rel="noreferrer"

          >

            Open Wig Request Form

          </a>

        </div>

      </AnimatedHighlight>

    </Page>

  );

}

/* =========================================================

   ROUTES

========================================================= */

function AppRoutes() {

  const location =

    useLocation();

  return (

    <AnimatePresence

      mode="wait"

      initial={false}

    >

      <motion.div

        key={

          location.pathname

        }

        initial={{

          opacity: 0,

        }}

        animate={{

          opacity: 1,

        }}

        exit={{

          opacity: 0,

        }}

        transition={{

          duration: 0.35,

        }}

      >

        <Routes

          location={location}

        >

          <Route

            path="/"

            element={

              <Home />

            }

          />

          <Route

            path="/about"

            element={

              <About />

            }

          />

          <Route

            path="/work"

            element={

              <Work />

            }

          />

          <Route

            path="/go-green"

            element={

              <GoGreen />

            }

          />

          <Route

            path="/hair-donation"

            element={

              <HairDonation />

            }

          />

          <Route

            path="/wig-request"

            element={

              <WigRequest />

            }

          />

          <Route

            path="/volunteer"

            element={

              <Volunteer />

            }

          />

          <Route

            path="/donate"

            element={

              <Donate />

            }

          />

          <Route

            path="/contact"

            element={

              <Contact />

            }

          />

        </Routes>

      </motion.div>

    </AnimatePresence>

  );

}

/* =========================================================

   APP

========================================================= */

export default function App() {

  return (

    <Layout>

      <AppRoutes />

    </Layout>

  );

}