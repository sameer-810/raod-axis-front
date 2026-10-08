import { Link } from "react-router-dom";
import { useSeo } from "@/shared/hooks/useSeo";
import { DEFAULT_POLICY, usePrivacyPolicy } from "@/modules/account/hooks/useAccount";
import { LegalDocument, LegalList } from "../components/LegalDocument";

/** "24 months" reads as "2 years"; "18 months" stays as it is. */
function months(n: number) {
  if (n % 12 === 0) return `${n / 12} year${n === 12 ? "" : "s"}`;
  return `${n} months`;
}

const link = "font-medium underline underline-offset-2 hover:text-primary-text";

/**
 * The Privacy Policy.
 *
 * Every period on this page comes from the API, which reads the same
 * configuration as the job that does the deleting. So the page cannot promise
 * ninety days while the server keeps things for ever — the failure a hand-typed
 * policy drifts into the first time somebody changes a setting.
 *
 * It describes what this software does. Who the company is, where it is
 * registered and which regulator number it holds are the operator's facts and
 * are printed only when the deployment has been given them.
 */
export function PrivacyPage() {
  const { data } = usePrivacyPolicy();
  const policy = data ?? DEFAULT_POLICY;
  const r = policy.retention;
  const bothCodes = policy.signIn === "email+whatsapp";

  useSeo({
    title: "Privacy Policy",
    description:
      "What RoadAxis collects, why, who sees it, how long it is kept, and how to get a copy of your data or delete your account.",
  });

  const contact = (
    <a href={`mailto:${policy.contactEmail}`} className={link}>
      {policy.contactEmail}
    </a>
  );

  return (
    <LegalDocument
      title="Privacy Policy"
      updated="7 October 2026"
      other={{ to: "/terms", label: "Terms of Use" }}
      summary={
        <p>
          You can search RoadAxis and read every garage page without an account and without telling
          us who you are. We ask for your details only when you send a booking request, save a
          garage, leave a review or claim a business — and we use them for that and nothing else. No
          advertising, no tracking, and nothing is sold.
        </p>
      }
      sections={[
        {
          id: "who",
          heading: "Who we are",
          body: (
            <>
              <p>
                RoadAxis is operated by <strong>{policy.controller}</strong>
                {policy.address ? <>, {policy.address}</> : null}. We are the data controller for
                the information described here
                {policy.icoRegistration ? (
                  <>
                    , registered with the Information Commissioner&rsquo;s Office under number{" "}
                    <span className="font-mono tabular-nums">{policy.icoRegistration}</span>
                  </>
                ) : null}
                .
              </p>
              <p>For anything about your data, write to {contact}.</p>
            </>
          ),
        },
        {
          id: "collect",
          heading: "What we collect, and why",
          body: (
            <>
              <p>
                <strong>If you only browse.</strong> Nothing that identifies you. When you open a
                garage&rsquo;s page we count the visit once a day, using a scrambled fingerprint of
                your connection and browser that cannot be turned back into either. If you use
                &ldquo;near me&rdquo;, your position is sent with the search so we can measure
                distance; it is not stored on our servers. Your browser remembers it on your own
                device so the next search is quicker.
              </p>
              <p>
                <strong>If you sign in as a driver.</strong> Your name, your email address and your
                WhatsApp number. We need the email to send your sign-in code
                {bothCodes ? " and the number to send a second code that proves it is yours" : ""},
                and the number so the garage you contact can reply to you.
              </p>
              <p>
                <strong>If you send a booking request.</strong> The service you asked for, the date
                and time you would like, and any note you add. This goes to the one business you
                sent it to, together with your name and number. No other business sees it.
              </p>
              <p>
                <strong>If you leave a review.</strong> Your rating and what you wrote, shown
                publicly on the garage&rsquo;s page beside the name on your account. We also show
                whether you had contacted that garage through RoadAxis.
              </p>
              <p>
                <strong>If you save a garage.</strong> Which garages you saved, so we can show you
                the list.
              </p>
              <p>
                <strong>If you claim or register a business.</strong> Your name, email, phone
                number, your role in the business, and a document proving it is yours — a licence, a
                tax document or a utility bill. The document is used for one thing: to decide
                whether the listing is yours. Only RoadAxis staff can open it, and it is never shown
                on the site.
              </p>
              <p>
                Our lawful basis for all of the above is that it is necessary to provide the service
                you asked for. Preventing fake listings and keeping a record of administrative
                decisions rests on our legitimate interest in running a directory people can trust.
              </p>
            </>
          ),
        },
        {
          id: "share",
          heading: "Who sees your information",
          body: (
            <>
              <LegalList
                items={[
                  <>
                    <strong>The business you contact</strong> receives your name, number and
                    request.
                  </>,
                  <>
                    <strong>Everyone</strong> can see a review you post, with your name.
                  </>,
                  <>
                    <strong>RoadAxis staff</strong> can see accounts, requests and ownership
                    documents in order to run and moderate the service. What they change is
                    recorded.
                  </>,
                  <>
                    <strong>The companies that run the service for us</strong>: our hosting and
                    database providers, the service that stores photographs, our email provider, and
                    WhatsApp (Meta) when a message is sent through our business account. They act on
                    our instructions and may not use your information for their own purposes.
                  </>,
                ]}
              />
              <p>
                Some parts of each page are loaded straight from other companies, which means they
                see your internet address as any website would: typefaces from Google Fonts, map
                images from OpenStreetMap, photographs from Cloudinary and Unsplash, and — if you
                type a postcode — a lookup at postcodes.io. Tapping &ldquo;Directions&rdquo; opens
                Google Maps and tapping a WhatsApp button opens WhatsApp; what happens there is
                covered by their policies.
              </p>
              <p>We do not sell personal information, and we do not use it for advertising.</p>
            </>
          ),
        },
        {
          id: "device",
          heading: "What is stored on your device",
          body: (
            <>
              <p>
                RoadAxis does not use advertising or analytics cookies. It keeps a small amount in
                your browser&rsquo;s own storage so that it works:
              </p>
              <LegalList
                items={[
                  "your sign-in, so you stay signed in between visits;",
                  "whether you chose the light or dark theme;",
                  "your last position, if you used “near me”;",
                  "a booking request you have started, until you send it or close the tab.",
                ]}
              />
              <p>Clearing your browser data removes all of it.</p>
            </>
          ),
        },
        {
          id: "retention",
          heading: "How long we keep it",
          body: (
            <>
              <p>
                These periods are enforced automatically, every day. Nothing is kept longer because
                nobody got round to deleting it.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pe-4 font-medium">
                        What
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Kept for
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <Row what="Sign-in codes" kept={`${r.signInCodeMinutes} minutes`} />
                    <Row what="The daily count of page visits" kept={`${r.profileViewDays} days`} />
                    <Row
                      what="Ownership documents"
                      kept={`${r.claimDocumentDays} days after we decide the claim, then deleted`}
                    />
                    <Row
                      what="Your name, number and note on a booking request"
                      kept={`${months(r.bookingRequestMonths)}, then removed from the request`}
                    />
                    <Row
                      what="Records of messages sent to a business"
                      kept={months(r.deliveryLogMonths)}
                    />
                    <Row
                      what="The record of administrative decisions"
                      kept={months(r.auditLogMonths)}
                    />
                    <Row
                      what="Your account, reviews and saved garages"
                      kept="Until you delete your account"
                    />
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          id: "rights",
          heading: "Your rights, and how to use them",
          body: (
            <>
              <LegalList
                items={[
                  <>
                    <strong>Get a copy.</strong> Sign in and open{" "}
                    <Link to="/account" className={link}>
                      your account
                    </Link>{" "}
                    to download everything we hold about you.
                  </>,
                  <>
                    <strong>Delete it.</strong> The same page deletes your account. Your reviews and
                    saved garages go with it, and your name, number and notes are removed from any
                    requests you sent. It cannot be undone.
                  </>,
                  <>
                    <strong>Correct it, or object.</strong> Write to {contact} and we will put it
                    right, or explain why we cannot.
                  </>,
                ]}
              />
              <p>
                You can also ask us for any of these by email, and we will answer within one month.
                If you are unhappy with how we have handled your information you can complain to the
                Information Commissioner&rsquo;s Office at{" "}
                <a
                  href="https://ico.org.uk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  ico.org.uk
                </a>
                .
              </p>
            </>
          ),
        },
        {
          id: "changes",
          heading: "Changes to this policy",
          body: (
            <p>
              If we change what we collect or how we use it, this page will say so and the date at
              the top will change.
            </p>
          ),
        },
      ]}
    />
  );
}

function Row({ what, kept }: { what: string; kept: string }) {
  return (
    <tr>
      <th scope="row" className="py-2.5 pe-4 align-top font-normal text-foreground">
        {what}
      </th>
      <td className="py-2.5 align-top text-muted-foreground">{kept}</td>
    </tr>
  );
}
