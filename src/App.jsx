import React from "react";

import { Routes, Route, Link } from "react-router-dom";

import mamtaCareLogo from "./assets/mamta-care-logo.jpeg";



const info = {

  phone: "+91 8500012190",

  email: "bharthairseva.in@gmail.com",

  instagram:

    "https://www.instagram.com/hairdonationmamtacare.india/",

  hairDonationForm: "https://forms.gle/VpKSKJoichRqyTvH9",

  wigRequestForm: "https://forms.gle/dUsSyhYEC37SsRTe6",

  volunteerForm: "https://forms.gle/4vwkLPmG9MTKsv1x8",

};



function Layout({ children }) {

  return (

    <>

      <header>

        <div className="nav">

          <Link
            className="brand"
            to="/"
            aria-label="Mamta Care Charitable Trust Home"
          >
            <img
              src={mamtaCareLogo}
              alt="Mamta Care Charitable Trust"
              style={{
                width: "250px",
                maxWidth: "42vw",
                height: "auto",
                display: "block",
              }}
            />
          </Link>



          <nav>

            <Link to="/">Home</Link>

            <Link to="/about">About Us</Link>

            <Link to="/work">Our Work</Link>



            <a

              href={info.hairDonationForm}

              target="_blank"

              rel="noreferrer"

            >

              Donate Your Hair

            </a>



            <a

              href={info.wigRequestForm}

              target="_blank"

              rel="noreferrer"

            >

              Request a Free Wig

            </a>



            <a

              href={info.volunteerForm}

              target="_blank"

              rel="noreferrer"

            >

              Volunteer

            </a>



            <Link to="/contact">Contact Us</Link>



            <Link className="donate" to="/donate">

              Donate Now

            </Link>

          </nav>

        </div>

      </header>



      <main>{children}</main>



      <footer>

        <div>

          <h3>MAMTA CARE CHARITABLE TRUST</h3>

          <p>Compassion • Support • Hope</p>

        </div>



        <div>

          <b>Contact</b>



          <p>

            {info.phone}

            <br />

            {info.email}

          </p>

        </div>



        <div>

          <b>Quick Links</b>



          <p>

            <a

              href={info.hairDonationForm}

              target="_blank"

              rel="noreferrer"

            >

              Donate Your Hair

            </a>



            <br />



            <a

              href={info.wigRequestForm}

              target="_blank"

              rel="noreferrer"

            >

              Request a Free Wig

            </a>



            <br />



            <a

              href={info.volunteerForm}

              target="_blank"

              rel="noreferrer"

            >

              Volunteer Registration

            </a>



            <br />



            <Link to="/work">Go Green Challenge</Link>



            <br />



            <Link to="/donate">Support Our Work</Link>

          </p>

        </div>

      </footer>

    </>

  );

}



function CTA() {

  return (

    <div className="actions">

      <a

        className="btn primary"

        href={info.hairDonationForm}

        target="_blank"

        rel="noreferrer"

      >

        ✂️ Donate Your Hair

      </a>



      <a

        className="btn"

        href={info.wigRequestForm}

        target="_blank"

        rel="noreferrer"

      >

        💇 Request a Free Wig

      </a>



      <Link className="btn" to="/about">

        Learn About Us

      </Link>

    </div>

  );

}



/* =========================

   HOME

========================= */



function Home() {

  return (

    <>

      {/* HERO */}

      <section className="hero hero-impact">

        <div className="hero-content">

          <p className="eyebrow">MAMTA CARE CHARITABLE TRUST</p>



          <h1>

            Donate Hair.

            <br />

            <em>Give Hope.</em>

          </h1>



          <p className="hero-text">

            A simple act can make a meaningful difference. MAMTA CARE

            CHARITABLE TRUST supports cancer patients by providing wigs free

            of cost and welcomes hair donations from people who want to help

            bring confidence and dignity to their treatment journey.

          </p>



          <CTA />



          <div className="hero-trust">

            <div>

              <strong>01</strong>

              <span>Donate Hair</span>

            </div>



            <div>

              <strong>02</strong>

              <span>Create Hope</span>

            </div>



            <div>

              <strong>03</strong>

              <span>Support Lives</span>

            </div>

          </div>

        </div>



        <div className="hero-visual">

          <div className="hero-image-placeholder">

            <div className="hero-photo-overlay">

              <span>✂️</span>



              <h3>Your Hair Can Give Hope</h3>



              <p>

                A small act of kindness can help bring confidence and dignity

                to someone facing cancer treatment.

              </p>

            </div>

          </div>



          <div className="hero-floating-card">

            <span>❤️</span>



            <div>

              <strong>Care with Purpose</strong>

              <small>Compassion • Dignity • Hope</small>

            </div>

          </div>

        </div>

      </section>



      {/* INTRO */}

      <section className="intro-section">

        <div className="section-head">

          <p className="eyebrow">WHY WE EXIST</p>



          <h2>Care That Creates Hope</h2>



          <p>

            At MAMTA CARE CHARITABLE TRUST, we believe that compassion becomes

            meaningful when it turns into action. Our initiatives focus on

            healthcare support, dignity, humanitarian assistance, hair

            donation and environmental awareness.

          </p>

        </div>



        <div className="cards">

          <Card

            number="01"

            t="Healthcare & Medical Support"

            d="Supporting people and families who need assistance with healthcare and medical-related needs."

          />



          <Card

            number="02"

            t="Free Wigs for Cancer Patients"

            d="Providing wigs free of cost to cancer patients experiencing hair loss, helping support confidence and dignity."

          />



          <Card

            number="03"

            t="Community & Humanitarian Support"

            d="Extending compassionate assistance to people facing challenging circumstances and supporting community wellbeing."

          />



          <Card

            number="04"

            t="Go Green Challenge"

            d="Encouraging people and communities to plant trees, share their green moments and inspire others."

          />

        </div>

      </section>



      {/* HAIR DONATION FEATURE */}

      <section className="highlight feature-section">

        <div>

          <p className="eyebrow">FEATURED INITIATIVE</p>



          <h2>Your Hair Can Give Hope</h2>



          <p>

            Hair donation is a simple way to support our free wig initiative.

            Your contribution can become part of a journey that helps a

            cancer patient feel more confident and cared for.

          </p>



          <a

            className="btn primary"

            href={info.hairDonationForm}

            target="_blank"

            rel="noreferrer"

          >

            ✂️ Start Hair Donation

          </a>

        </div>



        <div className="steps">

          {[

            "Decide to Donate",

            "Prepare Your Hair",

            "Send Your Hair",

            "Help Create Hope",

          ].map((item, index) => (

            <div key={item}>

              <span>0{index + 1}</span>

              <b>{item}</b>

            </div>

          ))}

        </div>

      </section>



      {/* FREE WIG */}

      <section className="wig">

        <div>

          <p className="eyebrow">FREE WIG SUPPORT</p>



          <h2>Support for Cancer Patients</h2>



          <p>

            Our free wig initiative aims to support cancer patients

            experiencing hair loss and help them feel confident, comfortable

            and cared for.

          </p>



          <a

            className="btn"

            href={info.wigRequestForm}

            target="_blank"

            rel="noreferrer"

          >

            💇 Request a Free Wig

          </a>

        </div>

      </section>



      {/* GO GREEN */}

      <section className="highlight">

        <div>

          <p className="eyebrow">🌱 GO GREEN CHALLENGE</p>



          <h2>Plant a Tree. Share the Hope.</h2>



          <p>

            Join our Go Green Challenge by planting a tree and encouraging

            others to take part. Together, small actions can help create

            greener and healthier communities.

          </p>



          <div className="steps">

            <div>

              <span>01</span>

              <b>Plant a Tree</b>

            </div>



            <div>

              <span>02</span>

              <b>Take a Photo</b>

            </div>



            <div>

              <span>03</span>

              <b>Share Your Green Moment</b>

            </div>



            <div>

              <span>04</span>

              <b>Challenge Others</b>

            </div>

          </div>

        </div>



        <div className="hero-card">

          <div className="hair-art">🌱</div>



          <h3>Your action can inspire another.</h3>



          <p>

            Our real plantation activity photographs will be added here

            later.

          </p>

        </div>

      </section>



      {/* VOLUNTEER */}

      <section className="highlight">

        <div>

          <p className="eyebrow">🤝 VOLUNTEER WITH US</p>



          <h2>Be a Part of the Change</h2>



          <p>

            Your time, skills and compassion can help us support people,

            communities and meaningful initiatives.

          </p>



          <a

            className="btn primary"

            href={info.volunteerForm}

            target="_blank"

            rel="noreferrer"

          >

            🤝 Register as a Volunteer

          </a>

        </div>



        <div className="hero-card">

          <div className="hair-art">🤝</div>



          <h3>Every helping hand matters.</h3>



          <p>

            Join our community and contribute your time, skills and support.

          </p>

        </div>

      </section>

    </>

  );

}



/* =========================

   CARD

========================= */



function Card({ number, t, d }) {

  return (

    <article className="card">

      <div className="card-number">{number}</div>



      <div className="icon">♡</div>



      <h3>{t}</h3>



      <p>{d}</p>

    </article>

  );

}



/* =========================

   ABOUT

========================= */



function About() {

  return (

    <Page

      title="About MAMTA CARE CHARITABLE TRUST"

      intro="A compassionate organization committed to creating meaningful support, protecting dignity and bringing hope through practical humanitarian initiatives."

    >

      {/* ABOUT INTRO */}

      <section className="about-intro">

        <div className="about-story">

          <p className="eyebrow">WHO WE ARE</p>



          <h2>Compassion That Becomes Action</h2>



          <p>

            MAMTA CARE CHARITABLE TRUST is committed to supporting people who

            need care, assistance and compassion. Our work brings together

            healthcare support, humanitarian initiatives, free wigs for

            cancer patients, hair donation awareness and environmental

            participation.

          </p>



          <p>

            We believe that meaningful change does not always begin with a

            large action. Sometimes it begins with one person choosing to

            help, one family receiving support, one hair donation becoming a

            wig, or one tree being planted for the future.

          </p>

        </div>



        <div className="about-values">

          <div>

            <span>01</span>

            <h3>Compassion</h3>

            <p>

              Listening, caring and treating people with dignity.

            </p>

          </div>



          <div>

            <span>02</span>

            <h3>Support</h3>

            <p>

              Turning kindness into practical assistance.

            </p>

          </div>



          <div>

            <span>03</span>

            <h3>Hope</h3>

            <p>

              Helping people feel supported, confident and cared for.

            </p>

          </div>

        </div>

      </section>



      {/* MISSION + VISION */}

      <section className="mission-vision">

        <div className="mission-box">

          <p className="eyebrow">OUR MISSION</p>



          <h2>Care That Creates Hope</h2>



          <p>

            To provide compassionate support through healthcare assistance,

            humanitarian initiatives and our free wig initiative while

            encouraging individuals and communities to participate in acts of

            kindness.

          </p>

        </div>



        <div className="vision-box">

          <p className="eyebrow">OUR VISION</p>



          <h2>A More Caring Community</h2>



          <p>

            To encourage a culture where people come together to support one

            another, protect dignity, create hope and contribute positively to

            their communities and environment.

          </p>

        </div>

      </section>



      {/* OUR VALUES */}

      <section>

        <div className="section-head">

          <p className="eyebrow">WHAT GUIDES US</p>



          <h2>Our Values</h2>



          <p>

            Our approach is grounded in compassion, dignity, community

            participation and meaningful action.

          </p>

        </div>



        <div className="cards">

          <Card

            number="01"

            t="Dignity"

            d="We believe every person deserves to be treated with respect and care."

          />



          <Card

            number="02"

            t="Compassion"

            d="We value kindness, empathy and human connection."

          />



          <Card

            number="03"

            t="Community"

            d="We encourage people to come together and contribute toward meaningful change."

          />



          <Card

            number="04"

            t="Action"

            d="We believe that even small acts can create meaningful positive impact."

          />

        </div>

      </section>



      {/* LEADERSHIP */}

      <section className="leadership-section">

        <div className="section-head">

          <p className="eyebrow">OUR LEADERSHIP</p>



          <h2>People Behind the Mission</h2>



          <p>

            The Trust is guided by people committed to compassionate service

            and meaningful community initiatives.

          </p>

        </div>



        <div className="people leadership-grid">

          <div className="person-card">

            <div className="person-avatar">MT</div>



            <h3>MAMTA THAKUR</h3>



            <span>Founder</span>

          </div>



          <div className="person-card">

            <div className="person-avatar">AT</div>



            <h3>ANIRUDH MUKUND THAKUR</h3>



            <span>Secretary</span>

          </div>



          <div className="person-card">

            <div className="person-avatar">GS</div>



            <h3>GNANESWAR SAI</h3>



            <span>Administrator</span>

          </div>

        </div>

      </section>



      {/* REACH */}

      <section className="reach-section">

        <div>

          <p className="eyebrow">OUR REACH</p>



          <h2>Connecting People Through Compassion</h2>



          <p>

            We support people and connect with supporters across India and

            internationally, including the UK, USA, New Zealand, Canada, UAE,

            Australia and Singapore.

          </p>

        </div>



        <div className="reach-list">

          <span>India</span>

          <span>UK</span>

          <span>USA</span>

          <span>New Zealand</span>

          <span>Canada</span>

          <span>UAE</span>

          <span>Australia</span>

          <span>Singapore</span>

        </div>

      </section>



      {/* VOLUNTEER CTA */}

      <section className="highlight small">

        <div>

          <p className="eyebrow">🤝 JOIN OUR COMMUNITY</p>



          <h2>Become a Volunteer</h2>



          <p>

            If you would like to contribute your time, skills or support,

            please register through our volunteer form.

          </p>



          <a

            className="btn primary"

            href={info.volunteerForm}

            target="_blank"

            rel="noreferrer"

          >

            🤝 Volunteer Registration

          </a>

        </div>

      </section>

    </Page>

  );

}



/* =========================

   OUR WORK

========================= */



function Work() {

  return (

    <Page

      title="Creating Support. Sharing Hope."

      intro="Our work focuses on practical support, dignity and compassionate community action."

    >

      <div className="cards">

        <Card

          number="01"

          t="Healthcare & Medical Support"

          d="Supporting people and families who need assistance with healthcare and medical-related needs."

        />



        <Card

          number="02"

          t="Free Wigs for Cancer Patients"

          d="Providing wigs free of cost to cancer patients experiencing hair loss."

        />



        <Card

          number="03"

          t="Community & Humanitarian Support"

          d="Extending compassionate assistance to people facing challenging circumstances."

        />



        <Card

          number="04"

          t="Go Green Challenge"

          d="Encouraging tree plantation and community participation through a simple challenge: plant, photograph, share and inspire."

        />



        <Card

          number="05"

          t="Volunteer With Us"

          d="Welcoming people who want to contribute their time, skills and support to our community initiatives."

        />

      </div>



      <div className="highlight small">

        <div>

          <p className="eyebrow">🌱 GO GREEN CHALLENGE</p>



          <h2>Plant a Tree. Share the Hope.</h2>



          <p>

            Join the Go Green Challenge and encourage others to take a simple

            step toward a greener community.

          </p>



          <div className="steps">

            <div>

              <span>01</span>

              <b>Plant a Tree</b>

            </div>



            <div>

              <span>02</span>

              <b>Take a Photo</b>

            </div>



            <div>

              <span>03</span>

              <b>Share Your Green Moment</b>

            </div>



            <div>

              <span>04</span>

              <b>Challenge Others</b>

            </div>

          </div>



          <div className="hero-card">

            <div className="hair-art">📸 🌳</div>



            <h3>Plantation Photo Gallery</h3>



            <p>

              Our real plantation activity photographs will be added here

              later.

            </p>

          </div>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <p className="eyebrow">🤝 VOLUNTEER WITH US</p>



          <h2>Become a Volunteer</h2>



          <p>

            Join our volunteer community and contribute your time, skills and

            support to meaningful initiatives.

          </p>



          <a

            className="btn primary"

            href={info.volunteerForm}

            target="_blank"

            rel="noreferrer"

          >

            🤝 Register as a Volunteer

          </a>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <h2>Your Hair Can Give Hope</h2>



          <p>Donate your hair to support our wig initiative.</p>



          <a

            className="btn primary"

            href={info.hairDonationForm}

            target="_blank"

            rel="noreferrer"

          >

            Donate Your Hair

          </a>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <h2>Request a Free Wig</h2>



          <p>

            If you or someone you know needs support, please complete our

            request form.

          </p>



          <a

            className="btn"

            href={info.wigRequestForm}

            target="_blank"

            rel="noreferrer"

          >

            💇 Request a Free Wig

          </a>

        </div>

      </div>

    </Page>

  );

}



/* =========================

   VOLUNTEER

========================= */



function Volunteer() {

  return (

    <Page

      title="Become a Volunteer"

      intro="Your time, skills and compassion can help us create meaningful support for people and communities."

    >

      <div className="highlight">

        <div>

          <p className="eyebrow">🤝 VOLUNTEER REGISTRATION</p>



          <h2>Be a Part of the Change</h2>



          <p>

            We welcome people who would like to contribute their time, skills

            and support to MAMTA CARE CHARITABLE TRUST initiatives.

          </p>



          <h3>Ways You May Contribute</h3>



          <div className="steps">

            <div>

              <span>01</span>

              <b>🌱 Go Green Challenge</b>

            </div>



            <div>

              <span>02</span>

              <b>💇 Hair Donation Awareness</b>

            </div>



            <div>

              <span>03</span>

              <b>🎗️ Cancer Patient Support</b>

            </div>



            <div>

              <span>04</span>

              <b>📢 Awareness & Outreach</b>

            </div>



            <div>

              <span>05</span>

              <b>📸 Photography & Social Media</b>

            </div>



            <div>

              <span>06</span>

              <b>💻 Digital & Administrative Support</b>

            </div>

          </div>



          <br />



          <a

            className="btn primary"

            href={info.volunteerForm}

            target="_blank"

            rel="noreferrer"

          >

            🤝 Open Volunteer Registration Form

          </a>

        </div>



        <div className="hero-card">

          <div className="hair-art">🤝</div>



          <h3>Every helping hand matters.</h3>



          <p>

            Complete our volunteer registration form to express your interest

            in supporting our work.

          </p>

        </div>

      </div>

    </Page>

  );

}



/* =========================

   DONATE

========================= */



function Donate() {

  return (

    <Page

      title="Support Our Work"

      intro="Your support can help MAMTA CARE CHARITABLE TRUST continue its humanitarian and healthcare initiatives and extend assistance to people who need it."

    >

      <div className="donation">

        <div className="qr">

          UPI / QR

          <br />

          <small>Upload your Trust QR image here</small>

        </div>



        <div>

          <h2>Donate via UPI</h2>



          <ol>

            <li>Open your preferred UPI app.</li>

            <li>Scan the Trust QR code.</li>

            <li>Enter your amount.</li>

            <li>Complete the payment.</li>

          </ol>



          <p>

            <b>Phone:</b> {info.phone}

            <br />

            <b>Email:</b> {info.email}

          </p>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <h2>Can't Donate Money? Donate Your Hair.</h2>



          <p>

            Your hair can become a meaningful gift of hope for a cancer

            patient.

          </p>



          <a

            className="btn primary"

            href={info.hairDonationForm}

            target="_blank"

            rel="noreferrer"

          >

            Donate Your Hair

          </a>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <p className="eyebrow">🌱 GO GREEN CHALLENGE</p>



          <h2>Support a Greener Future</h2>



          <p>

            You can also support our community-focused Go Green Challenge and

            help encourage tree plantation and environmental awareness.

          </p>



          <Link className="btn" to="/work">

            🌱 Learn About Go Green Challenge

          </Link>

        </div>

      </div>



      <div className="highlight small">

        <div>

          <p className="eyebrow">🤝 VOLUNTEER WITH US</p>



          <h2>Give Your Time & Skills</h2>



          <p>

            You can also support our work by volunteering your time, skills

            and energy.

          </p>



          <a

            className="btn"

            href={info.volunteerForm}

            target="_blank"

            rel="noreferrer"

          >

            🤝 Register as a Volunteer

          </a>

        </div>

      </div>

    </Page>

  );

}



/* =========================

   CONTACT

========================= */



function Contact() {

  function handleSubmit(event) {

    event.preventDefault();



    alert(

      "Thank you. Your message has been recorded in this demo. Supabase will be connected next."

    );

  }



  return (

    <Page

      title="Contact Us"

      intro="Whether you want to donate your hair, request a free wig, support our work, join the Go Green Challenge, volunteer, or simply learn more, please get in touch."

    >

      <div className="contact-grid">

        <div>

          <h3>Visit / Write to Us</h3>



          <p>

            Mamata Care Charitable Trust

            <br />

            Plot No. 5, Shankar Chavan Mala,

            <br />

            2nd Right Lane, Behind Kadam Dairy,

            <br />

            Jai Bhavani Road, Nashik Road,

            <br />

            Nashik – 422001, Maharashtra, India.

          </p>



          <p>

            <a href="tel:+918500012190">{info.phone}</a>

            <br />

            <a href={`mailto:${info.email}`}>{info.email}</a>

          </p>



          <a

            href={info.instagram}

            target="_blank"

            rel="noreferrer"

          >

            Instagram

          </a>

        </div>



        <form onSubmit={handleSubmit}>

          {["Full Name *", "Mobile Number *", "Email Address"].map(

            (label) => (

              <label key={label}>

                {label}



                <input required={label.includes("*")} />

              </label>

            )

          )}



          <label>

            Reason for Contact



            <select>

              <option>Hair Donation</option>

              <option>Free Wig Request</option>

              <option>Donation / Support</option>

              <option>Go Green Challenge</option>

              <option>Volunteering</option>

              <option>General Enquiry</option>

            </select>

          </label>



          <label>

            Message *



            <textarea required rows="6" />

          </label>



          <button className="btn primary" type="submit">

            Send Message

          </button>

        </form>

      </div>

    </Page>

  );

}



/* =========================

   PAGE

========================= */



function Page({ title, intro, children }) {

  return (

    <section className="page">

      <div className="section-head page-heading">

        <p className="eyebrow">MAMTA CARE CHARITABLE TRUST</p>



        <h1>{title}</h1>



        <p>{intro}</p>

      </div>



      {children}

    </section>

  );

}



/* =========================

   APP

========================= */



export default function App() {

  return (

    <Layout>

      <Routes>

        <Route path="/" element={<Home />} />



        <Route path="/about" element={<About />} />



        <Route path="/work" element={<Work />} />



        <Route

          path="/hair-donation"

          element={

            <Page

              title="Donate Your Hair"

              intro="Thank you for your interest in donating your hair to support cancer patients."

            >

              <div className="highlight small">

                <div>

                  <h2>Complete Our Hair Donation Form</h2>



                  <p>

                    Please click below to open our official Google Form and

                    submit your hair donation details.

                  </p>



                  <a

                    className="btn primary"

                    href={info.hairDonationForm}

                    target="_blank"

                    rel="noreferrer"

                  >

                    ✂️ Open Hair Donation Form

                  </a>

                </div>

              </div>

            </Page>

          }

        />



        <Route

          path="/wig-request"

          element={

            <Page

              title="Request a Free Wig"

              intro="If you or someone you know needs a wig, please complete our official request form."

            >

              <div className="highlight small">

                <div>

                  <h2>Free Wig Request Form</h2>



                  <p>

                    Please click below to open our official Google Form and

                    submit your request.

                  </p>



                  <a

                    className="btn primary"

                    href={info.wigRequestForm}

                    target="_blank"

                    rel="noreferrer"

                  >

                    💇 Open Free Wig Request Form

                  </a>

                </div>

              </div>

            </Page>

          }

        />



        <Route path="/volunteer" element={<Volunteer />} />



        <Route path="/donate" element={<Donate />} />



        <Route path="/contact" element={<Contact />} />

      </Routes>

    </Layout>

  );

}