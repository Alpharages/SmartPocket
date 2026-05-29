# Expense Tracker Mobile App - Interface Design

## Overview

A personal finance management app designed for iOS-like experience with portrait orientation (9:16) and one-handed usage. The app enables users to track income and expenses, categorize transactions, view monthly summaries, and manage credit cards.

---

## Screen List

### 1. **Dashboard (Home Screen)**
   - Primary screen showing financial overview
   - Quick stats: Total balance, month-to-date income, month-to-date expenses
   - Recent transactions list (last 5-7 transactions)
   - Quick action buttons: Add Income, Add Expense, View All
   - Credit card summary badge (if cards exist)

### 2. **Add Transaction Screen**
   - Modal/sheet for adding income or expense
   - Transaction type selector (Income / Expense toggle)
   - Amount input field
   - Category picker (dropdown or button grid)
   - Date picker (defaults to today)
   - Optional description/notes field
   - Credit card selector (if applicable for expense)
   - Save/Cancel buttons

### 3. **Transactions List Screen**
   - Full list of all transactions with filtering
   - Filter options: Date range, Category, Type (Income/Expense)
   - Each transaction shows: Amount, Category, Date, Description
   - Swipe-to-delete or long-press menu
   - Search by description
   - Grouped by date (Today, Yesterday, This Week, etc.)

### 4. **Categories Screen**
   - Predefined and custom categories
   - Expense categories: Food, Transport, Entertainment, Utilities, Shopping, Healthcare, Other
   - Income categories: Salary, Freelance, Investment, Bonus, Other
   - Add custom category option
   - Edit/delete categories
   - Category color picker
   - View spending by category

### 5. **Monthly Summary Screen**
   - Monthly overview with date picker
   - Total income, total expenses, net balance
   - Pie chart or bar chart showing expense breakdown by category
   - Category-wise spending list with percentages
   - Comparison with previous month (optional)
   - Export or share summary option

### 6. **Credit Cards Screen**
   - List of saved credit cards
   - Card details: Name, Last 4 digits, Card type, Balance/Limit
   - Add new card button
   - Edit/delete card options
   - View transactions for specific card
   - Card color/theme selector

### 7. **Add/Edit Credit Card Screen**
   - Card name input
   - Card number input (masked)
   - Cardholder name
   - Expiry date
   - Credit limit input
   - Card color/icon picker
   - Save/Cancel buttons

### 8. **Settings Screen**
   - Currency selection
   - Theme (Light/Dark mode)
   - Notification preferences
   - Data export/backup
   - About app

---

## Primary Content and Functionality

### Dashboard
- **Top Section**: Summary cards showing:
  - Current month balance (green for positive, red for negative)
  - Total income (green badge)
  - Total expenses (red badge)
- **Recent Transactions**: Horizontal scrollable or vertical list
  - Each item: Category icon, Description, Amount, Date
  - Tap to view/edit details
- **Quick Actions**: Three prominent buttons at bottom
  - "Add Income" (green)
  - "Add Expense" (red)
  - "View All Transactions" (neutral)

### Add Transaction
- **Type Toggle**: Segmented control (Income / Expense)
- **Amount Input**: Large, prominent numeric input with currency symbol
- **Category Picker**: Grid of category buttons with icons and colors
- **Date/Time**: Date picker with time (optional)
- **Description**: Optional text field
- **Card Selector**: Dropdown for credit card selection (if expense)
- **Save Button**: Prominent, enabled only when amount is entered

### Transactions List
- **Filter Bar**: Horizontal scroll of filter chips (All, This Month, This Week, etc.)
- **Category Filter**: Dropdown or expandable filter section
- **Transaction Items**: 
  - Left: Category icon with color
  - Middle: Description + Date
  - Right: Amount (green for income, red for expense)
- **Swipe Actions**: Delete or Edit on swipe
- **Empty State**: "No transactions" message with add button

### Monthly Summary
- **Header**: Month/Year selector with prev/next arrows
- **Summary Cards**: Income, Expenses, Net (with trend indicators)
- **Chart**: Pie chart or horizontal bar chart of expenses by category
- **Category Breakdown**: List showing each category with amount and percentage
- **Actions**: Export as PDF, Share, Print

### Credit Cards
- **Card List**: Vertical list of cards
  - Each card shows: Card name, last 4 digits, card type icon, balance/limit
  - Tap to view details or edit
- **Add Card Button**: Prominent button at bottom
- **Card Actions**: Edit, Delete, View Transactions

---

## Key User Flows

### Flow 1: Add an Expense
1. User taps "Add Expense" button on Dashboard
2. Add Transaction modal opens with Expense pre-selected
3. User enters amount (e.g., 25.50)
4. User selects category (e.g., Food)
5. User selects date (defaults to today)
6. User optionally adds description (e.g., "Lunch at cafe")
7. User optionally selects credit card
8. User taps "Save"
9. Modal closes, Dashboard updates with new transaction

### Flow 2: View Monthly Summary
1. User navigates to Monthly Summary tab
2. Current month is displayed by default
3. User sees total income, expenses, and net balance
4. User sees pie chart of expense breakdown
5. User can tap on a category in the chart to filter transactions for that category
6. User can swipe left/right to view previous/next months
7. User can tap "Export" to save summary as PDF

### Flow 3: Manage Credit Card
1. User navigates to Credit Cards screen
2. User taps "Add Card" button
3. Add Card modal opens
4. User enters card details (name, number, expiry, limit)
5. User selects card color/theme
6. User taps "Save"
7. Card appears in list
8. User can tap card to view associated transactions
9. User can swipe to delete or tap menu to edit

### Flow 4: Filter Transactions
1. User navigates to Transactions List
2. User taps on a category filter chip (e.g., "Food")
3. List updates to show only Food category transactions
4. User can add more filters (e.g., "This Month")
5. User can clear all filters with "Reset" button

---

## Color Choices

### Primary Colors
- **Primary Accent**: #0a7ea4 (Teal/Blue) - Used for buttons, active states, highlights
- **Success Green**: #22C55E - Income, positive balance, confirmations
- **Error Red**: #EF4444 - Expenses, negative balance, deletions
- **Warning Orange**: #F59E0B - Alerts, pending transactions

### Neutral Colors
- **Background**: #ffffff (Light mode) / #151718 (Dark mode)
- **Surface**: #f5f5f5 (Light mode) / #1e2022 (Dark mode)
- **Foreground**: #11181C (Light mode) / #ECEDEE (Dark mode)
- **Muted**: #687076 (Light mode) / #9BA1A6 (Dark mode)
- **Border**: #E5E7EB (Light mode) / #334155 (Dark mode)

### Category Colors
- **Food**: #FF6B6B (Red)
- **Transport**: #4ECDC4 (Teal)
- **Entertainment**: #FFE66D (Yellow)
- **Utilities**: #95E1D3 (Mint)
- **Shopping**: #FF85A2 (Pink)
- **Healthcare**: #A8E6CF (Light Green)
- **Salary**: #22C55E (Green)
- **Freelance**: #3B82F6 (Blue)
- **Investment**: #8B5CF6 (Purple)
- **Other**: #6B7280 (Gray)

---

## Typography & Spacing

### Font Sizes
- **Heading 1**: 32px (Dashboard title)
- **Heading 2**: 24px (Section titles)
- **Heading 3**: 18px (Card titles)
- **Body**: 16px (Regular text)
- **Caption**: 14px (Secondary text)
- **Small**: 12px (Timestamps, hints)

### Spacing
- **Padding**: 16px (standard), 12px (compact), 20px (generous)
- **Gap**: 8px (tight), 12px (standard), 16px (loose)
- **Border Radius**: 12px (standard), 8px (compact), 16px (large)

---

## Interaction Patterns

### Feedback
- **Button Press**: Scale 0.97 + light haptic feedback
- **List Item Tap**: Opacity 0.7 + navigation
- **Swipe Delete**: Confirm with haptic feedback
- **Success**: Green checkmark + success haptic
- **Error**: Red alert + error haptic

### Animations
- **Screen Transitions**: Subtle slide (150ms)
- **Modal Entry**: Fade + slide up (250ms)
- **List Item Deletion**: Fade out (200ms)
- **Chart Animation**: Staggered bar animation (500ms)

---

## Accessibility

- Minimum touch target: 44x44pt
- Color contrast: WCAG AA compliant
- Text scaling: Support up to 200% scaling
- VoiceOver support for all interactive elements
- Haptic feedback for all confirmations
