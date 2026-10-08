import { useSeo } from "@/shared/hooks/useSeo";
import { DEFAULT_POLICY, usePrivacyPolicy } from "@/modules/account/hooks/useAccount";
import { LegalDocument, LegalList } from "../components/LegalDocument";

const link = "font-medium underline underline-offset-2 hover:text-primary-text";

/**
 * The Terms of Use.
 *
 * The clause that matters most is the second one, because it is the promise the
 * whole interface is built around: a booking request is a message asking for a
 * time, and nobody has agreed to anything until the garage says so. Every
 * screen avoids the word "booked" for that reason, and the terms say it once
 * more in the place a dispute would look.
 */
export function TermsPage() {
  const { data } = usePrivacyPolicy();
  const policy = data ?? DEFAULT_POLICY;

  useSeo({
    title: "Terms of Use",
    description:
      "The terms for using RoadAxis: what a booking request is, what a Verified badge means, and what drivers and businesses agree to.",
  });

  return (
    <LegalDocument
      title="Terms of Use"
      updated="7 October 2026"
      other={{ to: "/privacy", label: "Privacy Policy" }}
      summary={
        <p>
          RoadAxis helps you find an independent garage and ask it for a time. The work, the price
          and the appointment are agreed between you and the garage. These terms set out what each
          of us is responsible for.
        </p>
      }
      sections={[
        {
          id: "service",
          heading: "What RoadAxis is",
          body: (
            <>
              <p>
                RoadAxis is a directory of automotive businesses and a way to contact them. It is
                operated by <strong>{policy.controller}</strong>. We do not repair, service or
                recover vehicles, we do not employ the businesses listed, and we are not a party to
                any agreement you make with one of them.
              </p>
              <p>
                Searching and reading business pages is free and needs no account. Sending a booking
                request, saving a garage and leaving a review need you to sign in.
              </p>
            </>
          ),
        },
        {
          id: "requests",
          heading: "A booking request is a request",
          body: (
            <>
              <p>
                When you send a booking request you are asking a business whether it can see you at
                the date and time you would prefer. It is <strong>not</strong> a confirmed
                appointment, and no time is held for you until the business replies and agrees one
                with you directly.
              </p>
              <p>
                RoadAxis passes your request on by WhatsApp. We cannot promise that a business will
                read it, reply to it or accept it, and we are not responsible if it does not. No
                payment is taken through RoadAxis; anything you pay, you pay the business.
              </p>
            </>
          ),
        },
        {
          id: "drivers",
          heading: "If you are a driver",
          body: (
            <LegalList
              items={[
                "Give your real name and a phone number that is yours. The business will use it to reply.",
                "Send requests you mean. Sending the same business request after request is limited and may lead to your account being switched off.",
                "Reviews must be your own honest experience of that business. Do not post a review for payment, on behalf of the business, or about a business you have a stake in.",
                "We may remove a review that is abusive, false or not about a real visit, and we will record why.",
              ]}
            />
          ),
        },
        {
          id: "businesses",
          heading: "If you run a business",
          body: (
            <>
              <LegalList
                items={[
                  "A listing may exist before you claim it. Claiming it, or registering a new one, requires a document showing the business is yours.",
                  "Keep your details, services, prices and opening hours accurate. Drivers rely on them, and “open now” is worked out from the hours you give.",
                  "Booking requests arrive on the WhatsApp number you mark as primary. Answering them is your responsibility; how quickly you answer is shown to you and is used in our own reporting.",
                  "You are responsible for the work you do, the prices you charge and for complying with the law that applies to your trade.",
                ]}
              />
              <p>
                A <strong>Verified</strong> badge means we have checked a document showing who
                controls the listing. It is not an endorsement of the quality of the work, a
                guarantee, or a statement that the business holds any particular qualification or
                insurance.
              </p>
              <p>
                We may suspend a listing, or remove a Verified badge, where a listing appears to be
                fake, has been claimed by somebody who does not control the business, or is being
                used to mislead drivers. The reason is recorded and you can ask us for it.
              </p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          heading: "What nobody may do",
          body: (
            <LegalList
              items={[
                "Claim a business that is not yours, or submit a document that is not genuine.",
                "Use somebody else’s email address or phone number to sign in.",
                "Copy the directory in bulk, or use automated tools to collect it.",
                "Interfere with the service or try to get at information that is not yours.",
              ]}
            />
          ),
        },
        {
          id: "accounts",
          heading: "Your account",
          body: (
            <p>
              You can delete your account at any time from your account page; what that removes is
              set out in our Privacy Policy. We may switch off an account that breaks these terms.
              If we do, we will tell you why if you ask.
            </p>
          ),
        },
        {
          id: "liability",
          heading: "Our responsibility to you",
          body: (
            <>
              <p>
                We take care to keep the directory accurate, but listings are supplied by businesses
                and by public sources and we cannot check every detail. Check anything that matters
                to you — a price, an opening time, a qualification — with the business itself.
              </p>
              <p>
                We are not responsible for the work a business does, for a request that goes
                unanswered, or for loss arising from an agreement between you and a business.
                Nothing in these terms limits any liability that cannot be limited under the law of
                England and Wales, or takes away rights you have as a consumer.
              </p>
            </>
          ),
        },
        {
          id: "general",
          heading: "Changes, and the law that applies",
          body: (
            <>
              <p>
                We may change these terms as the service changes. The date at the top shows when
                they last did, and continuing to use RoadAxis after a change means you accept it.
              </p>
              <p>
                These terms are governed by the law of England and Wales. Questions about them can
                be sent to{" "}
                <a href={`mailto:${policy.contactEmail}`} className={link}>
                  {policy.contactEmail}
                </a>
                .
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
