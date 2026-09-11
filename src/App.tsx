import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { PublicLayout } from "./app/layouts/PublicLayout";
import { RequireAuth } from "./app/router/RequireAuth";
import { NotFoundPage } from "./app/router/NotFoundPage";
import { PageLoader } from "./shared/components/PageLoader";

/**
 * Two route trees:
 *
 *   /            public, guest-first  → PublicLayout
 *   /portal/*    business owner       → AppLayout
 *   /admin/*     RoadAxis staff       → AppLayout
 *
 * Every page is lazy — a driver landing on a business profile from a search
 * result should not download the admin console to see it.
 */
/* The console shell — sidebar, palette, menus — is a driver's-eye no-show:
   nothing on the public side needs it, so it stays out of the first chunk. */
const AppLayout = lazy(() =>
  import("./app/layouts/AppLayout").then((m) => ({ default: m.AppLayout })),
);
const HomePage = lazy(() =>
  import("./modules/home/pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const SearchPage = lazy(() =>
  import("./modules/business/pages/SearchPage").then((m) => ({ default: m.SearchPage })),
);
const CategoriesPage = lazy(() =>
  import("./modules/business/pages/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
);
const BusinessProfilePage = lazy(() =>
  import("./modules/business/pages/BusinessProfilePage").then((m) => ({
    default: m.BusinessProfilePage,
  })),
);
const SignInPage = lazy(() =>
  import("./modules/auth/pages/SignInPage").then((m) => ({ default: m.SignInPage })),
);
const StaffSignInPage = lazy(() =>
  import("./modules/auth/pages/StaffSignInPage").then((m) => ({ default: m.StaffSignInPage })),
);
const ForBusinessPage = lazy(() =>
  import("./modules/claim/pages/ForBusinessPage").then((m) => ({ default: m.ForBusinessPage })),
);
const ClaimBusinessPage = lazy(() =>
  import("./modules/claim/pages/ClaimBusinessPage").then((m) => ({
    default: m.ClaimBusinessPage,
  })),
);
const RegisterBusinessPage = lazy(() =>
  import("./modules/claim/pages/RegisterBusinessPage").then((m) => ({
    default: m.RegisterBusinessPage,
  })),
);
const AcceptInvitePage = lazy(() =>
  import("./modules/auth/pages/AcceptInvitePage").then((m) => ({ default: m.AcceptInvitePage })),
);
const AdminClaimsPage = lazy(() =>
  import("./modules/admin/pages/AdminClaimsPage").then((m) => ({ default: m.AdminClaimsPage })),
);
const PortalOverviewPage = lazy(() =>
  import("./modules/portal/pages/PortalOverviewPage").then((m) => ({
    default: m.PortalOverviewPage,
  })),
);
const PortalWhatsAppPage = lazy(() =>
  import("./modules/portal/pages/PortalWhatsAppPage").then((m) => ({
    default: m.PortalWhatsAppPage,
  })),
);
const AdminAuditPage = lazy(() =>
  import("./modules/admin/pages/AdminAuditPage").then((m) => ({ default: m.AdminAuditPage })),
);
const AdminWhatsAppLogsPage = lazy(() =>
  import("./modules/admin/pages/AdminWhatsAppLogsPage").then((m) => ({
    default: m.AdminWhatsAppLogsPage,
  })),
);
const PortalRequestsPage = lazy(() =>
  import("./modules/portal/pages/PortalRequestsPage").then((m) => ({
    default: m.PortalRequestsPage,
  })),
);
const RequestBookingPage = lazy(() =>
  import("./modules/booking/pages/RequestBookingPage").then((m) => ({
    default: m.RequestBookingPage,
  })),
);
const MyRequestsPage = lazy(() =>
  import("./modules/booking/pages/MyRequestsPage").then((m) => ({ default: m.MyRequestsPage })),
);
const AdminBusinessesPage = lazy(() =>
  import("./modules/admin/pages/AdminBusinessesPage").then((m) => ({
    default: m.AdminBusinessesPage,
  })),
);
const AdminBusinessFormPage = lazy(() =>
  import("./modules/admin/pages/AdminBusinessFormPage").then((m) => ({
    default: m.AdminBusinessFormPage,
  })),
);
const AdminCategoriesPage = lazy(() =>
  import("./modules/admin/pages/AdminCategoriesPage").then((m) => ({
    default: m.AdminCategoriesPage,
  })),
);
const MyGaragesPage = lazy(() =>
  import("./modules/favourite/pages/MyGaragesPage").then((m) => ({ default: m.MyGaragesPage })),
);
const AdminAnalyticsPage = lazy(() =>
  import("./modules/analytics/pages/AdminAnalyticsPage").then((m) => ({
    default: m.AdminAnalyticsPage,
  })),
);
const PortalAnalyticsPage = lazy(() =>
  import("./modules/analytics/pages/PortalAnalyticsPage").then((m) => ({
    default: m.PortalAnalyticsPage,
  })),
);
const AdminReviewsPage = lazy(() =>
  import("./modules/admin/pages/AdminReviewsPage").then((m) => ({ default: m.AdminReviewsPage })),
);
const PortalListingPage = lazy(() =>
  import("./modules/portal/pages/PortalListingPage").then((m) => ({
    default: m.PortalListingPage,
  })),
);
const AdminImportPage = lazy(() =>
  import("./modules/admin/pages/AdminImportPage").then((m) => ({ default: m.AdminImportPage })),
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public. Nothing here is gated — guests browse the whole product and
            the account wall stands only at the booking-request form. */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          {/* By slug, not id: this is the page that has to be findable, because
              the whole Claim Your Business feature depends on an owner
              discovering their own listing. */}
          <Route path="business/:slug" element={<BusinessProfilePage />} />

          {/* Onboarding. All public: a garage owner should not have to create an
              account before they know whether their claim will be accepted. */}
          <Route path="for-business" element={<ForBusinessPage />} />
          <Route path="business/:slug/claim" element={<ClaimBusinessPage />} />
          <Route path="register-business" element={<RegisterBusinessPage />} />

          <Route path="sign-in" element={<SignInPage />} />
          <Route path="staff/sign-in" element={<StaffSignInPage />} />
          {/* The link itself is the credential — there is nothing else to
              authenticate with, because this person has never signed in. */}
          <Route path="accept-invite" element={<AcceptInvitePage />} />

          {/* The one wall in the public product. The page itself is open — the
              form is filled in before an account is asked for, and the draft is
              kept across the sign-in detour. */}
          <Route path="business/:slug/request" element={<RequestBookingPage />} />
          <Route
            path="my-requests"
            element={
              <RequireAuth>
                <MyRequestsPage />
              </RequireAuth>
            }
          />

          {/* The retention screen. Somebody's own saved list, so it is the one
              public-tree route behind the wall. */}
          <Route
            path="my-garages"
            element={
              <RequireAuth>
                <MyGaragesPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Authenticated. `roles` here is navigation, not access control — the
            server checks every route regardless, and a hidden screen has never
            stopped anyone with a terminal. */}
        <Route
          path="/portal"
          element={
            <RequireAuth roles={["business_owner", "admin"]}>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<PortalOverviewPage />} />
          <Route path="listing" element={<PortalListingPage />} />
          <Route path="requests" element={<PortalRequestsPage />} />
          <Route path="whatsapp" element={<PortalWhatsAppPage />} />
          <Route path="performance" element={<PortalAnalyticsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth roles={["admin"]}>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminBusinessesPage />} />
          <Route path="businesses" element={<AdminBusinessesPage />} />
          {/* Before "businesses/:id", so "new" and "import" are never read as ids. */}
          <Route path="businesses/new" element={<AdminBusinessFormPage />} />
          <Route path="businesses/import" element={<AdminImportPage />} />
          <Route path="businesses/:id" element={<AdminBusinessFormPage />} />
          <Route path="claims" element={<AdminClaimsPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="whatsapp-logs" element={<AdminWhatsAppLogsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
