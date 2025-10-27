// src/app/router/index.tsx

import { Authenticated, Unauthenticated } from "convex/react";
import { Redirect, Route, Switch } from "wouter";

import AnalyticsPage from "@pages/Analytics";
import App from "@pages/App";
import CallbackPage from "@pages/Auth/Callback";
import EmailConfirmationPage from "@pages/Auth/EmailConfirmation";
import LoginRedirectPage from "@pages/Auth/LoginRedirect";
import LogoutRedirectPage from "@pages/Auth/LogoutRedirect";
import MagicLinkPage from "@pages/Auth/MagicLinkPage";
import VerifiedPage from "@pages/Auth/Verified";
import DashboardPage from "@pages/Dashboard";
import IntegrationsPage from "@pages/Integrations";
import InventoryPage from "@pages/Inventory";
import OnboardingPage from "@pages/Onboarding";
import OrdersPage from "@pages/Orders";
import CreateOrderPage from "@pages/Orders/CreateOrder";
import PrivacyPolicy from "@pages/Privacy";
import ProductsPage from "@pages/Products";
import StaffManagementPage from "@pages/Staff";
import TermsOfService from "@pages/Terms";

export function AppRoutes() {
  return (
    <Switch>
      <Route path="/">{() => <App />}</Route>
      <Route path="/link">
        {() => (
          <>
            <Authenticated>
              <Redirect to="/" />
            </Authenticated>
            <Unauthenticated>
              <MagicLinkPage />
            </Unauthenticated>
          </>
        )}
      </Route>
      <Route path="/auth/callback">{() => <CallbackPage />}</Route>
      <Route path="/email-confirmation">{() => <EmailConfirmationPage />}</Route>
      <Route path="/verified">{() => <VerifiedPage />}</Route>
      <Route path="/login">{() => <LoginRedirectPage />}</Route>
      <Route path="/logout">{() => <LogoutRedirectPage />}</Route>
      <Route path="/terms">{() => <TermsOfService />}</Route>
      <Route path="/privacy">{() => <PrivacyPolicy />}</Route>
      <Route path="/onboarding">{() => <OnboardingPage />}</Route>
      <Route path="/dashboard">{() => <DashboardPage />}</Route>
      <Route path="/integrations">{() => <IntegrationsPage />}</Route>
      <Route path="/staff">{() => <StaffManagementPage />}</Route>
      <Route path="/analytics">{() => <AnalyticsPage />}</Route>
      <Route path="/inventory">{() => <InventoryPage />}</Route>
      <Route path="/products">{() => <ProductsPage />}</Route>
      <Route path="/orders/new">{() => <CreateOrderPage />}</Route>
      <Route path="/orders">{() => <OrdersPage />}</Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
