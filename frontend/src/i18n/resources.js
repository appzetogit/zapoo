export const resources = {
  en: {
    translation: {
      common: {
        language: "Language",
        languageNames: {
          en: "English",
          hi: "Hindi",
          bn: "Bengali"
        },
        cancel: "Cancel",
        save: "Save",
        saving: "Saving...",
        savingLanguage: "Saving language...",
        languageRefreshNotice: "The app will refresh to apply the language change.",
        languageSettingsDescription: "Choose the language used across the app.",
        languageUpdated: "{{language}} updated",
        languageUpdateFailed: "Failed to update language preference"
      },
      user: {
        settings: {
          title: "Settings",
          notificationsPreferences: "Notifications & Preferences",
          emailNotifications: "Email Notifications",
          emailNotificationsDescription: "Receive updates about your orders via email",
          pushNotifications: "Push Notifications",
          pushNotificationsDescription: "Receive push notifications on your device"
        },
        carousel: {
          previous: "Previous",
          next: "Next"
        },
        bottomNavigation: {
          delivery: "Delivery",
          under250: "Under 250",
          profile: "Profile"
        },
        locationDisplay: {
          selectLocation: "Select location",
          gettingLocation: "Getting location...",
          locationUnavailable: "Location unavailable",
          locationUnavailableWithError: "Location unavailable: {{error}}",
          deliveringTo: "Delivering to",
          select: "Select",
          loading: "Loading...",
          currentLocation: "Current Location"
        },
        locationExample: {
          basicHookUsage: "Basic Hook Usage",
          loadingLocation: "Loading location...",
          area: "Area",
          city: "City",
          state: "State",
          coordinates: "Coordinates",
          notAvailable: "Not available",
          getLocation: "Get Location",
          selectLocation: "Select location",
          deliveringTo: "Delivering to",
          loading: "Loading...",
          usingLocationDisplayComponent: "Using LocationDisplay Component",
          fullDisplay: "Full Display",
          compactDisplayNavbar: "Compact Display (Navbar)",
          fullLocationDisplay: "Full Location Display",
          allowLocation: "Allow Location",
          cart: "Cart",
          profile: "Profile"
        },
        userHome: {
          title: "User Module",
          subtitle: "Welcome to the User section"
        },
        auth: {
          signIn: {
            bannerAlt: "Food Banner",
            title: "India's #1 Food Delivery App",
            subtitle: "Log in or sign up",
            selectCountryCode: "Select country code",
            placeholders: {
              fullName: "Enter your full name",
              phoneNumber: "Enter Phone Number",
              email: "Enter your email address"
            },
            usePhoneInstead: "Use phone instead",
            rememberMe: "Remember my login for faster sign-in",
            creatingAccount: "Creating Account...",
            signingIn: "Signing In...",
            continue: "Continue",
            or: "or",
            signInWithGoogle: "Sign in with Google",
            signInWithEmail: "Sign in with Email",
            disclaimer: "By continuing, you agree to our",
            termsOfService: "Terms of Service",
            privacyPolicy: "Privacy Policy",
            contentPolicy: "Content Policy",
            validation: {
              emailRequired: "Email is required",
              emailInvalid: "Please enter a valid email address",
              phoneRequired: "Phone number is required",
              phone10Digits: "Phone number must be 10 digits",
              phoneRange: "Phone number must be between 7-15 digits",
              nameRequired: "Name is required",
              nameMin: "Name must be at least 2 characters",
              nameMax: "Name must be less than 50 characters",
              namePattern: "Name can only contain letters, spaces, hyphens, and apostrophes"
            },
            errors: {
              invalidServerResponse: "Invalid response from server. Please try again.",
              failedToCompleteSignIn: "Failed to complete sign-in. Please try again.",
              googleSignInFailed: "Google sign-in failed. Please try again.",
              serverError: "Server error. Please try again later.",
              authenticationFailed: "Authentication failed. Please try again.",
              networkError: "Network error. Please check your connection and try again.",
              invalidCredentials: "Invalid credentials. Please try again.",
              failedToSendOtp: "Failed to send OTP. Please try again.",
              firebaseNotInitialized: "Firebase Auth is not initialized. Please check your Firebase configuration.",
              firebaseConfiguration: "Firebase configuration error. Please ensure your domain is authorized in Firebase Console. Current domain: {{domain}}",
              popupBlocked: "Popup was blocked. Please allow popups and try again.",
              signInCancelled: "Sign-in was cancelled. Please try again."
            }
          },
          otp: {
            title: "OTP Verification",
            oneLastThing: "One last thing",
            namePrompt: "Please tell us your name to complete your profile",
            enterOtpSentTo: "Please enter the OTP sent to your {{target}}",
            email: "email",
            mobileNumber: "mobile number",
            sentTo: "Sent to",
            didntReceiveCode: "Didn't receive code?",
            remaining: "remaining",
            resendOtp: "Resend OTP",
            yourFullName: "Your Full Name",
            namePlaceholder: "e.g. Rahul Sharma",
            completeRegistration: "Complete Registration",
            submit: "Submit",
            changeMobileNumber: "Change Mobile Number",
            validation: {
              nameRequired: "Name is required",
              nameMin: "Name must be at least 2 characters"
            },
            errors: {
              invalidServerResponse: "Invalid response from server",
              failedToVerify: "Failed to verify OTP. Please try again.",
              verificationStepMissing: "OTP verification step missing. Please request a new OTP.",
              failedToCompleteRegistration: "Failed to complete registration. Please try again.",
              failedToResend: "Failed to resend OTP. Please try again."
            }
          }
        },
        notificationPopup: {
          specialOffer: "Special Offer",
          close: "Close"
        },
        collectionsPage: {
          yourCollections: "Your Collections",
          defaultBookmarks: "Bookmarks",
          delivery: "Delivery",
          dishCount_one: "{{count}} dish",
          dishCount_other: "{{count}} dishes",
          restaurantCount_one: "{{count}} restaurant",
          restaurantCount_other: "{{count}} restaurants",
          itemCounts: "{{dishes}} {{dishesLabel}} • {{restaurants}} {{restaurantsLabel}}",
          createNew: "Create a new",
          collection: "Collection",
          createNewCollection: "Create New Collection",
          uniqueNamePrompt: "Give your collection a unique name",
          collectionNamePlaceholder: "e.g., Weekend Favorites",
          preview: "Preview",
          createCollection: "Create Collection"
        },
        categoryPage: {
          all: "All",
          searchPlaceholder: "Restaurant name or a dish...",
          loadingCategories: "Loading categories...",
          noCategoriesAvailable: "No categories available",
          filters: "Filters",
          allRestaurants: "ALL RESTAURANTS",
          loadingRestaurants: "Loading restaurants...",
          notAvailable: "Not available",
          noRestaurantsForQuery: "No restaurants found for \"{{query}}\"",
          noRestaurantsWithFilters: "No restaurants found with selected filters",
          clearAllFilters: "Clear all filters",
          filtersAndSorting: "Filters and sorting",
          clearAll: "Clear all",
          sortBy: "Sort by",
          deliveryTime: "Delivery Time",
          restaurantRating: "Restaurant Rating",
          rated35Plus: "Rated 3.5+",
          under200: "Under ₹200",
          under500: "Under ₹500",
          priceMatch: "Price Match",
          trustMarkers: "Trust Markers",
          topRated: "Top Rated",
          trustedByUsers: "Trusted by 1000+ users",
          close: "Close",
          showResults: "Show results",
          filterPills: {
            under30mins: "Under 30 mins",
            under45mins: "Under 45 mins",
            rating4Plus: "Rating 4.0+",
            rating45Plus: "Rating 4.5+",
            under1km: "Under 1 km",
            under2km: "Under 2 km",
            flat50off: "Flat 50% OFF",
            under250: "Under ₹250"
          },
          tabs: {
            sortBy: "Sort By",
            time: "Time",
            rating: "Rating",
            distance: "Distance",
            dishPrice: "Dish Price",
            cuisine: "Cuisine",
            offers: "Offers",
            trust: "Trust"
          },
          sortOptions: {
            relevance: "Relevance",
            priceLowToHigh: "Price: Low to High",
            priceHighToLow: "Price: High to Low",
            ratingHighToLow: "Rating: High to Low",
            ratingLowToHigh: "Rating: Low to High"
          },
          cuisines: {
            chinese: "Chinese",
            american: "American",
            japanese: "Japanese",
            italian: "Italian",
            mexican: "Mexican",
            indian: "Indian",
            asian: "Asian",
            seafood: "Seafood",
            desserts: "Desserts",
            cafe: "Cafe",
            healthy: "Healthy"
          }
        },
        searchResults: {
          matchingDishesAndRestaurants: "MATCHING DISHES & RESTAURANTS",
          dishWithRestaurant: "Dish · {{restaurant}}",
          restaurantFallback: "Restaurant",
          closed: "Closed",
          noMatchesFound: "No matches found."
        },
        under250: {
          title: "Under 250",
          bannerTitle: "Modern & Trendy",
          bannerAlt: "Under 250 Banner",
          sort: "Sort",
          apply: "Apply",
          add: "Add",
          viewFullMenu: "View full menu",
          bestPrice: "Best price",
          noRestaurantsUnder250: "No restaurants with dishes under ₹250 found.",
          noRestaurantsWithFilters: "No restaurants match the selected filters.",
          itemDescriptionFallback: "{{item}} from {{restaurant}}",
          sortOptions: {
            deliveryTimeLowToHigh: "Delivery Time: Low to High",
            distanceLowToHigh: "Distance: Low to High"
          }
        },
        productDetail: {
          productNotFound: "Product Not Found",
          goBackHome: "Go Back Home",
          review: "Review",
          reviews: "Reviews",
          perServing: "per serving",
          home: "Home",
          restaurant: "Restaurant",
          order: "Order",
          inCart: "In cart",
          addToCartWithAmount: "Add to Cart - ₹{{amount}}",
          details: "Details",
          category: "Category",
          preparationTime: "Preparation Time",
          calories: "Calories",
          kcalValue: "{{calories}} kcal",
          ingredients: "Ingredients",
          itemsCount: "{{count}} items",
          yourOrderHistory: "Your Order History",
          orderWithId: "Order {{id}}",
          you: "You",
          delivery: "Delivery",
          alerts: {
            reviewCommentRequired: "Please write a review comment",
            reviewThankYou: "Thank you for your review!",
            replyRequired: "Please write a reply"
          }
        },
        top10: {
          title: "Top Restaurants",
          subtitle: "Most loved restaurants in your area",
          loadingTopRestaurants: "Loading Top Restaurants...",
          failedToLoadTopRestaurants: "Failed to load Top Restaurants",
          retry: "Retry",
          noTopRestaurants: "No Top Restaurants available at the moment"
        },
        home: {
          exploreMoreHeading: "Explore More",
          searchPlaceholderBurger: "Search \"burger\"",
          searchPlaceholderBiryani: "Search \"biryani\"",
          searchPlaceholderPizza: "Search \"pizza\"",
          searchPlaceholderDesserts: "Search \"desserts\"",
          searchPlaceholderChinese: "Search \"chinese\"",
          searchPlaceholderThali: "Search \"thali\"",
          searchPlaceholderMomos: "Search \"momos\"",
          searchPlaceholderDosa: "Search \"dosa\"",
          voiceNotSupported: "Speech Recognition is not supported in this browser.",
          listening: "Listening...",
          searchingFor: "Searching for \"{{text}}\"",
          microphoneDenied: "Microphone access denied. Please enable it in browser settings.",
          couldNotHear: "Could not hear you. Please try again.",
          vegMode: "MODE",
          orderNow: "Order Now",
          seeAll: "See all",
          noCategories: "No categories available",
          filters: "Filters",
          handpickedForYou: "Handpicked for you",
          topRestaurants: "Top Restaurants",
          loadingRestaurants: "Loading restaurants...",
          loading: "Loading...",
          showResults: "Show results",
          select: "Select",
          location: "Location",
          goToImage: "Go to image {{index}}",
          inTheSpotlight: "IN THE SPOTLIGHT",
          restaurantsDeliveringToYou: "{{count}} Restaurants Delivering to You",
          featured: "Featured",
          removeFromFavorites: "Remove from favorites",
          addToFavorites: "Add to favorites",
          byRatings: "By {{value}}",
          allCategories: "All Categories",
          close: "Close",
          addedToBookmark: "Added to bookmark",
          exploreItems: {
            offers: "Offers",
            gourmet: "Gourmet",
            topRestaurants: "Top Restaurants",
            collections: "Collections"
          },
          filterTabs: {
            sortBy: "Sort By",
            time: "Time",
            rating: "Rating",
            distance: "Distance",
            dishPrice: "Dish Price",
            cuisine: "Cuisine",
            offers: "Offers",
            trust: "Trust"
          },
          sortOptions: {
            relevance: "Relevance",
            priceLowToHigh: "Price: Low to High",
            priceHighToLow: "Price: High to Low",
            ratingHighToLow: "Rating: High to Low",
            ratingLowToHigh: "Rating: Low to High"
          },
          quickFilters: {
            under30Mins: "Under 30 mins",
            under45Mins: "Under 45 mins",
            under1Km: "Under 1km",
            under2Km: "Under 2km"
          },
          cuisineOptions: {
            chinese: "Chinese",
            american: "American",
            japanese: "Japanese",
            italian: "Italian",
            mexican: "Mexican",
            indian: "Indian",
            asian: "Asian",
            seafood: "Seafood",
            desserts: "Desserts",
            cafe: "Cafe",
            healthy: "Healthy"
          },
          fallbacks: {
            deliveryTime2530: "25-30 mins",
            deliveryTime2025: "20-25 mins",
            distance1_2km: "1.2 km",
            multiCuisine: "Multi-cuisine",
            specialSuffix: "Special",
            specialDish: "Special Dish"
          },
          filterModal: {
            title: "Filters and sorting",
            clearAll: "Clear all",
            close: "Close",
            sections: {
              sortBy: "Sort by",
              deliveryTime: "Delivery Time",
              restaurantRating: "Restaurant Rating",
              distance: "Distance",
              dishPrice: "Dish Price",
              cuisine: "Cuisine",
              trustMarkers: "Trust Markers",
              offers: "Offers"
            },
            options: {
              under30Mins: "Under 30 mins",
              under45Mins: "Under 45 mins",
              rated35Plus: "Rated 3.5+",
              rated40Plus: "Rated 4.0+",
              rated45Plus: "Rated 4.5+",
              under1Km: "Under 1 km",
              under2Km: "Under 2 km",
              under200: "Under ₹200",
              under500: "Under ₹500",
              topRated: "Top Rated",
              trustedByUsers: "Trusted by 1000+ users",
              restaurantsWithOffers: "Restaurants with offers"
            }
          },
          vegPopup: {
            title: "See veg dishes from",
            allRestaurants: "All restaurants",
            pureVegOnly: "Pure Veg restaurants only",
            apply: "Apply",
            moreSettings: "More settings"
          },
          switchOffPopup: {
            title: "Switch off Veg Mode?",
            description: "You'll see all restaurants, including those serving non-veg dishes",
            switchOff: "Switch off",
            keepUsing: "Keep using this mode"
          },
          vegLoading: {
            exploreVeg: "Explore veg dishes from all restaurants"
          },
          switchingOff: {
            title: "Switching off",
            subtitle: "Veg Mode for you"
          },
          manageCollections: {
            title: "Manage Collections",
            bookmarks: "Bookmarks",
            bookmarksCount_one: "{{count}} restaurant",
            bookmarksCount_other: "{{count}} restaurants",
            createNew: "Create new Collection",
            done: "Done"
          },
          gstDialog: {
            title: "GST breakdown",
            description: "Government taxes collected on food, delivery and platform charges.",
            foodPriceGst: "Food price GST (5%)",
            onAmountAfterDiscount: "On {{amount}} after discount",
            deliveryFeeGst: "Delivery fee GST (18%)",
            platformFeeGst: "Platform fee GST (18%)",
            onAmount: "On {{amount}}",
            totalGst: "Total GST"
          },
          restaurantDetails: {
            loadingRestaurant: "Loading restaurant...",
            connectionError: "Connection Error",
            restaurantNotFound: "Restaurant not found",
            error: "Error",
            backendRunningAt: "Make sure the backend server is running at {{url}}",
            goBack: "Go Back",
            search: "Search",
            searchForDishes: "Search for dishes...",
            unknownRestaurant: "Unknown Restaurant",
            outOfDeliveryRangeBadge: "Out of delivery range — change address to order",
            byReviews: "By {{count}}+",
            fallbackDistance: "1.2 km",
            fallbackLocation: "Location",
            fallbackDeliveryTime: "25-30 mins",
            fallbackRestaurantInitial: "R",
            filters: "Filters",
            veg: "Veg",
            nonVeg: "Non-veg",
            unnamedSection: "Unnamed Section",
            recommendedForYou: "Recommended for you",
            noDishRecommended: "No dish recommended",
            subsection: "Subsection",
            mustTry: "MUST TRY",
            requested: "REQUESTED",
            highlyReordered: "Highly reordered",
            noImage: "No image",
            add: "ADD",
            outOfDeliveryRange: "Out of delivery range",
            menu: "Menu",
            largeOrderMenu: "LARGE ORDER MENU",
            largeOrderComingSoon: "Large order options coming soon",
            close: "Close",
            filtersAndSorting: "Filters and Sorting",
            sortBy: "Sort by:",
            priceLowToHigh: "Price - low to high",
            priceHighToLow: "Price - high to low",
            vegNonVegPreference: "Veg/Non-veg preference:",
            topPicks: "Top picks:",
            dietaryPreference: "Dietary preference:",
            spicy: "Spicy",
            clearAll: "Clear All",
            apply: "Apply",
            allDeliveryOutletsFor: "All delivery outlets for",
            nearestAvailableOutlet: "Nearest available outlet",
            noOutletsAvailable: "No outlets available",
            seeAllOutlets: "See all {{count}} outlets",
            manageCollections: "Manage Collections",
            bookmarks: "Bookmarks",
            bookmarksSummary: "{{dishes}} dishes • {{restaurants}} restaurant",
            createNewCollection: "Create new Collection",
            done: "Done",
            noImageAvailable: "No image available",
            notEligibleForCoupons: "NOT ELIGIBLE FOR COUPONS",
            addItem: "Add item",
            offersAt: "Offers at {{restaurant}}",
            goldExclusiveOffer: "Gold exclusive offer",
            freeDeliveryAbove99: "Free delivery above ₹99",
            joinGoldToUnlock: "join Gold to unlock",
            addGold: "Add Gold - ₹1",
            restaurantCoupons: "Restaurant coupons",
            useCode: "Use code {{code}}",
            termsApply: "Terms and conditions apply",
            removeFromCollection: "Remove from Collection",
            addToCollection: "Add to Collection",
            shareThisRestaurant: "Share this restaurant",
            disclaimer: "Menu items, prices, photos and descriptions are set directly by the restaurant. In case you see any incorrect information, please report it to us.",
            multiCuisine: "Multi-cuisine",
            specialDish: "Special Dish",
            thisRestaurant: "this restaurant",
            shareRestaurantText: "Check out {{restaurant}} on {{company}}! {{url}}",
            shareDishText: "Check out {{dish}} from {{restaurant}}! {{url}}",
            toast: {
              loginToAddItems: "Please login to add items to cart",
              outsideServiceZone: "You are outside the service zone. Please select a location within the service area.",
              restaurantOutOfRange: "This restaurant does not deliver to your current address. Change your delivery location to order.",
              itemInfoMissing: "Item information is missing. Please refresh the page.",
              restaurantInfoMissingRefresh: "Restaurant information is missing. Please refresh the page.",
              restaurantIdMissing: "Restaurant ID is missing. Please refresh the page.",
              cannotAddDifferentRestaurant: "Cannot add item from different restaurant. Please clear cart first.",
              restaurantInfoMissing: "Restaurant information is missing",
              dishInfoMissing: "Dish information is missing",
              dishRemoved: "Dish removed from favorites",
              dishAdded: "Dish added to favorites",
              restaurantDataUnavailable: "Restaurant data not available",
              restaurantRemovedFromCollection: "Restaurant removed from collection",
              restaurantAddedToCollection: "Restaurant added to collection",
              restaurantShared: "Restaurant shared successfully",
              dishShared: "Dish shared successfully",
              linkCopied: "Link copied to clipboard!",
              copyFailed: "Failed to copy link"
            }
          }
        },
        accessibility: {
          title: "Accessibility",
          hero: {
            title: "Make the app more accessible",
            description: "Customize your experience to better suit your needs and preferences."
          },
          options: {
            largeText: {
              label: "Large Text",
              description: "Increase text size for better readability"
            },
            highContrast: {
              label: "High Contrast",
              description: "Enhance contrast for better visibility"
            },
            screenReaderSupport: {
              label: "Screen Reader Support",
              description: "Optimize for screen readers"
            },
            reduceMotion: {
              label: "Reduce Motion",
              description: "Minimize animations and transitions"
            }
          },
          needMoreHelp: {
            title: "Need more help?",
            description: "If you need additional accessibility features or have suggestions, please contact our support team.",
            contactSupport: "Contact Support"
          }
        },
        coupons: {
          title: "Your coupons",
          empty: {
            title: "No coupons found",
            description: "Discover hidden coupons on your map screen after placing an order"
          }
        },
        trackingPage: {
          restaurantName: "Sagar Restaurant",
          orderPlaced: "Order placed",
          foodPreparationSoon: "Food preparation will begin shortly",
          arrivingIn: "ARRIVING IN",
          arrivalMins: "{{mins}} mins",
          distanceAway: "{{km}} km away",
          foodCooking: "Food is Cooking",
          deliveryPartnerSafety: "Learn about delivery partner safety",
          deliveryDetailsBanner: "All your delivery details in one place 👋",
          contactName: "Ajay Panchal",
          edit: "Edit",
          deliveryAtLocation: "Delivery at Location",
          deliveryAddressSample: "X2RJ+QHR, Dewas, Madhya Pradesh 45..."
        },
        navbar: {
          loading: "Loading...",
          select: "Select",
          location: "Location",
          wallet: "Wallet",
          cart: "Cart",
          pointsTitle: "{{points}} Points",
          menu: {
            cart: "YOUR CART",
            profile: "Profile",
            myOrders: "My Orders",
            offers: "Offers",
            help: "Help",
            signOut: "Sign Out"
          }
        },
        stickyCart: {
          restaurant: "Restaurant",
          viewMenu: "View Menu",
          viewCart: "View Cart",
          itemsCount_one: "{{count}} item",
          itemsCount_other: "{{count}} items"
        },
        notifications: {
          title: "Notifications",
          promotionsAndOffers: "Promotions and Offers",
          ordersAndUpdates: "Orders and Updates",
          emptyTitle: "No notifications",
          emptyDescription: "You're all caught up!",
          time: {
            justNow: "Just now",
            minutesAgo: "{{count}}m ago",
            hoursAgo: "{{count}}h ago"
          },
          sample: {
            orderConfirmedTitle: "Order Confirmed",
            orderConfirmedMessage: "Your order #12345 has been confirmed and is being prepared",
            twoMinutesAgo: "2 minutes ago",
            specialOfferTitle: "Special Offer",
            specialOfferMessage: "Get 50% off on your next order above INR 500",
            oneHourAgo: "1 hour ago",
            newRestaurantTitle: "New Restaurant Added",
            newRestaurantMessage: "Check out the new Italian restaurant in your area",
            threeHoursAgo: "3 hours ago",
            orderDeliveredTitle: "Order Delivered",
            orderDeliveredMessage: "Your order #12340 has been delivered successfully",
            yesterday: "Yesterday",
            paymentFailedTitle: "Payment Failed",
            paymentFailedMessage: "Your payment for order #12338 failed. Please try again",
            twoDaysAgo: "2 days ago",
            weekendSpecialTitle: "Weekend Special",
            weekendSpecialMessage: "Enjoy free delivery on all orders this weekend",
            threeDaysAgo: "3 days ago"
          }
        },
        offers: {
          bannerAlt: "Great Offers",
          loading: "Loading offers...",
          retry: "Retry",
          empty: "No offers available at the moment",
          errorFallback: "Failed to load offers"
        },
        top10: {
          bannerAlt: "Top Restaurants",
          title: "Top Restaurants",
          subtitle: "Most loved restaurants in your area",
          loading: "Loading Top Restaurants...",
          retry: "Retry",
          empty: "No Top Restaurants available at the moment",
          errorFallback: "Failed to load Top Restaurants"
        },
        gourmet: {
          bannerAlt: "Gourmet Food",
          title: "Premium Gourmet Restaurants",
          subtitle: "Exquisite dishes delivered to your doorstep",
          count: "{{count}} GOURMET RESTAURANTS",
          loading: "Loading Gourmet restaurants...",
          retry: "Retry",
          empty: "No Gourmet restaurants available at the moment",
          errorFallback: "Failed to load Gourmet restaurants"
        },
        orders: {
          title: "Your Orders",
          searchPlaceholder: "Search by restaurant or dish",
          viewMenu: "View menu",
          viewDetails: "View Details",
          reorder: "Reorder",
          youRated: "You rated",
          rateOrder: "Rate order",
          orderPlacedOn: "Order placed on",
          deliveredOn: "Delivered on",
          payment: "Payment:",
          locationNotAvailable: "Location not available",
          restaurantFallback: "Restaurant",
          brandName: "appzeto",
          deliveryLabel: "Delivery",
          noItemsFound: "No items found",
          itemFallback: "Item",
          each: "each",
          optional: "Optional",
          refundInfo: "Refund will be processed in 24-48 hours",
          countdownRemaining_one: "{{count}} min remaining",
          countdownRemaining_other: "{{count}} mins remaining",
          paymentMethod: {
            cashOnDelivery: "Cash on Delivery",
            wallet: "Wallet",
            online: "Online",
            na: "N/A"
          },
          paymentStatus: {
            completed: "Completed",
            failed: "Failed",
            pending: "Pending",
            refunded: "Refunded",
            processing: "Processing",
            unknown: "Unknown"
          },
          share: {
            text: "Check out {{restaurant}} on {{companyName}}.\nLocation: {{location}}\nOrder again from this restaurant in the {{companyName}} app."
          },
          menu: {
            shareRestaurant: "Share restaurant",
            orderDetails: "Order details"
          },
          empty: {
            noOrders: "You haven't placed any orders yet",
            startOrdering: "Start Ordering",
            noSearchResults: "No orders found matching your search"
          },
          error: {
            failedToLoad: "Failed to load orders",
            loginRequired: "Please login to view your orders"
          },
          toast: {
            restaurantInfoMissing: "Restaurant information not available",
            restaurantCopied: "Restaurant details copied to clipboard",
            sharingNotSupported: "Sharing is not supported on this device",
            shareFailed: "Failed to share restaurant"
          },
          summary: {
            subtotal: "Subtotal",
            deliveryFee: "Restaurant Delivery Fee",
            tax: "Tax",
            discount: "Discount",
            couponApplied: "Coupon Applied",
            total: "Total"
          },
          status: {
            deliveredWithIcon: "✓ Delivered",
            restaurantCancelledWithIcon: "✗ Restaurant Cancelled",
            cancelledByYouWithIcon: "✗ Cancelled by you",
            cancelledWithIcon: "✗ Cancelled",
            restaurantCancelled: "Restaurant Cancelled",
            paymentFailed: "Payment failed",
            orderDelivered: "Order delivered",
            preparing: "Preparing",
            outForDelivery: "Out for delivery",
            orderConfirmed: "Order confirmed"
          },
          rating: {
            title: "Rate Your Order",
            orderLabel: "Order",
            experienceQuestion: "How was your overall experience?",
            poor: "Poor",
            average: "Average",
            excellent: "Excellent",
            shareFeedback: "Share your feedback",
            feedbackPlaceholder: "What did you like or dislike about this order? Share your experience...",
            feedbackHint: "Your feedback helps us improve our service",
            submitting: "Submitting...",
            submit: "Submit Rating",
            selectToContinue: "Please select a rating to continue",
            selectFirst: "Please select a rating first",
            thanks: "Thanks for rating your order! 🎉",
            submitFailed: "Failed to submit rating. Please try again.",
            legend: {
              five: "⭐⭐⭐⭐⭐ Excellent!",
              four: "⭐⭐⭐⭐ Great!",
              three: "⭐⭐⭐ Good",
              two: "⭐⭐ Fair",
              one: "⭐ Poor"
            }
          }
        },
        cart: {
          error: {
            title: "Cart Error",
            description: "Cart functionality is not available. Please refresh the page.",
            goHome: "Go to Home"
          },
          paymentOptions: {
            razorpay: {
              label: "Razorpay",
              description: "Pay online instantly"
            },
            wallet: {
              label: "Wallet",
              description: "Use your wallet balance",
              balanceAvailable: "Balance available: Rs {{amount}}"
            },
            cash: {
              label: "Cash on Delivery",
              description: "Pay when your order arrives"
            }
          },
          addressLabel: {
            home: "Home",
            office: "Office",
            other: "Other"
          },
          ui: {
            cart: "Cart",
            restaurant: "Restaurant",
            yourCartIsEmpty: "Your cart is empty",
            emptyCartHint: "Add items from a restaurant to start a new order",
            browseRestaurants: "Browse Restaurants",
            to: "to",
            location: "Location",
            selectAddress: "Select address",
            youSavedOnOrder: "🎉 You saved ₹{{amount}} on this order",
            addMoreItems: "Add more items",
            edit: "Edit",
            done: "Done",
            addNoteForRestaurant: "Add a note for the restaurant",
            dontSendCutlery: "Don't send cutlery",
            noCutlery: "No cutlery",
            notePlaceholder: "Add cooking instructions, allergies, etc.",
            completeYourMealWith: "Complete your meal with",
            couponApplied: "'{{code}}' applied",
            youSavedAmount: "You saved ₹{{amount}}",
            remove: "Remove",
            loadingCoupons: "Loading coupons...",
            saveWithCoupon: "Save ₹{{amount}} with '{{code}}'",
            viewAllCoupons: "View all coupons →",
            minAmount: "Min ₹{{amount}}",
            apply: "APPLY",
            noCouponsAvailable: "No coupons available",
            deliveryIn: "Delivery in",
            chooseDeliveryFleetType: "Choose delivery fleet type",
            standardFleet: "Standard Fleet",
            standardFleetDescription: "Our standard food delivery experience",
            specialVegOnlyFleet: "Special Veg-only Fleet",
            specialVegOnlyFleetDescription: "Fleet delivering only from Pure Veg restaurants",
            deliveryAt: "Delivery at",
            addDeliveryAddress: "Add delivery address",
            yourName: "Your Name",
            phoneFallback: "+91-XXXXXXXXXX",
            customerNameForOrderPlaceholder: "Customer name for this order",
            customerPhoneForOrderPlaceholder: "Customer phone for this order",
            contactUpdateNote: "This updates contact only for this order, not your profile.",
            totalBill: "Total Bill",
            includingTaxesAndCharges: "Incl. taxes and charges",
            itemTotal: "Item Total",
            deliveryFee: "Restaurant Delivery Fee",
            free: "FREE",
            platformFee: "Platform Fee",
            gstAndRestaurantCharges: "GST and Restaurant Charges",
            gstGovTaxes: "GST (govt. taxes)",
            couponDiscount: "Coupon Discount",
            toPay: "To Pay",
            orderSummary: "Order Summary",
            gst: "GST",
            discount: "Discount",
            total: "Total",
            payUsing: "PAY USING",
            tapToChange: "Tap to change",
            totalUpper: "TOTAL",
            processing: "Processing...",
            selectPayment: "Select Payment",
            placeOrder: "Place Order",
            insufficientBalance: "Insufficient Balance",
            choosePaymentMethod: "Choose Payment Method",
            choosePaymentMethodDescription: "Pick the option that feels best for checkout on mobile.",
            payOnlineRazorpay: "Pay ₹{{amount}} online (Razorpay)",
            payFromWallet: "Pay ₹{{amount}} from Wallet",
            payOnDeliveryCod: "Pay on delivery (COD)",
            deliveringToLocation: "Delivering to Location",
            addAddress: "Add address",
            address: "Address",
            orderPlaced: "Order Placed!",
            placingYourOrder: "Placing your order",
            yourLocation: "Your Location",
            unknownRestaurant: "Unknown Restaurant",
            orderPreparedWithCare: "Your delicious food is being prepared with care",
            deliveringTo: "Delivering to",
            estimatedTime: "Estimated Time",
            defaultEtaShort: "10-15 mins",
            defaultEtaLong: "25-30 mins",
            trackYourOrder: "Track Your Order",
            deliveryPricingWarning: "Delivery could not be priced. Check zone, distance slabs, and the delivery rate grid in restaurant settings."
          },
          toast: {
            invalidCoordinates: "Invalid coordinates for {{label}} address",
            addressSelected: "{{label}} address selected!",
            failedToSelectAddress: "Failed to select {{label}} address. Please try again.",
            pleaseAddDeliveryAddress: "Please add a delivery address",
            cartEmpty: "Your cart is empty",
            itemsFromDifferentRestaurantsRemoved: "Cart contained items from different restaurants. Items from other restaurants have been removed.",
            itemsFromDifferentRestaurants: "Cart contains items from different restaurants. Please clear cart and try again.",
            insufficientWalletBalance: "Insufficient wallet balance. Required: ₹{{required}}, Available: ₹{{available}}",
            orderPlacedCod: "Order placed with Cash on Delivery",
            orderPlacedWallet: "Order placed with Wallet payment",
            razorpayNotConfigured: "Razorpay payment gateway is not configured. Please contact support.",
            failedToInitializePayment: "Failed to initialize payment",
            paymentVerificationFailed: "Payment verification failed. Please contact support.",
            paymentFailed: "Payment failed. Please try again.",
            failedToCreateOrder: "Failed to create order. Please try again.",
            requestTimedOut: "Request timed out. The server is taking too long to respond. Please try again.",
            restaurantInfoMissing: "Restaurant information is missing. Please refresh the page.",
            restaurantInfoMissingWithRefresh: "Error: Restaurant information is missing. Please refresh the page and try again.",
            restaurantDataMismatchWithCart: "Error: Cart items belong to \"{{restaurant}}\" but restaurant data doesn't match. Please refresh the page and try again.",
            restaurantNameMismatch: "Error: Cart items belong to \"{{cartRestaurantName}}\" but restaurant data shows \"{{finalRestaurantName}}\". Please refresh the page and try again.",
            restaurantInfoMismatchDetected: "Error: Restaurant information mismatch detected. Please refresh the page and try again."
          }
        },
        checkout: {
          title: "Checkout",
          yourCartIsEmpty: "Your cart is empty",
          goToCart: "Go to Cart",
          deliveryAddress: "Delivery Address",
          default: "Default",
          noAddressesSaved: "No addresses saved",
          addAddress: "Add Address",
          paymentMethod: "Payment Method",
          expires: "Expires",
          managePaymentMethods: "Manage Payment Methods",
          noPaymentMethodsSaved: "No payment methods saved",
          addPaymentMethod: "Add Payment Method",
          orderSummary: "Order Summary",
          subtotal: "Subtotal",
          deliveryFee: "Restaurant Delivery Fee",
          platformFee: "Platform Fee",
          gst: "GST",
          total: "Total",
          calculating: "Calculating...",
          placingOrder: "Placing Order...",
          placeOrder: "Place Order",
          toast: {
            selectAddressAndPayment: "Please select a delivery address and payment method",
            cartEmpty: "Your cart is empty",
            invalidDeliveryAddress: "Invalid delivery address",
            missingRestaurant: "Missing restaurant — open checkout from the restaurant cart.",
            orderPlacedCod: "Order placed with Cash on Delivery",
            orderPlacedWallet: "Order placed with Wallet",
            razorpayNotConfigured: "Razorpay is not configured.",
            failedToStartPayment: "Failed to start payment",
            paymentSuccessful: "Payment successful",
            verificationFailed: "Verification failed",
            paymentVerificationFailed: "Payment verification failed",
            paymentFailed: "Payment failed",
            failedToPlaceOrder: "Failed to place order"
          }
        },
        invoice: {
          orderNotFound: "Order Not Found",
          backToOrders: "Back to Orders",
          invoice: "Invoice",
          invoiceUpper: "INVOICE",
          orderWithId: "Order {{id}}",
          print: "Print",
          downloadPdf: "Download PDF",
          foodDeliveryPlatform: "Food Delivery Platform",
          billTo: "Bill To:",
          invoiceDetails: "Invoice Details:",
          invoiceNumber: "Invoice #",
          date: "Date",
          payment: "Payment",
          paymentMethod: {
            cashOnDelivery: "Cash on Delivery",
            wallet: "Wallet",
            online: "Online"
          },
          orderItems: "Order Items:",
          item: "Item",
          quantity: "Quantity",
          unitPrice: "Unit Price",
          total: "Total",
          qty: "Qty",
          subtotal: "Subtotal",
          deliveryFee: "Restaurant Delivery Fee",
          tax: "Tax",
          thankYou: "Thank you for your order!",
          supportLine: "For any queries, please contact our support team.",
          trackOrder: "Track Order"
        },
        orderHelp: {
          na: "N/A",
          title: "Order Help",
          orderWithId: "Order {{id}}",
          orderSummary: "Order Summary",
          orderId: "Order ID",
          placedOn: "Placed On",
          totalAmount: "Total Amount",
          items: "Items",
          itemsCount_one: "{{count}} item",
          itemsCount_other: "{{count}} items",
          deliveryAddress: "Delivery Address",
          whatCanWeHelpWith: "What can we help you with?",
          whatToDo: "What to do:",
          quickActions: "Quick Actions",
          trackOrderDescription: "View real-time status",
          viewInvoiceDescription: "Download receipt",
          contactSupportDescription: "Get help now",
          contactSupportForOrder: "Contact Support for This Order",
          supportReadyDescription: "Our support team is ready to help you with order {{id}}",
          phoneSupport: "Phone Support",
          mentionOrder: "Mention order {{id}}",
          emailSupport: "Email Support",
          includeOrderInSubject: "Include order {{id}} in subject",
          startLiveChat: "Start Live Chat",
          backToAllOrders: "Back to All Orders",
          helpCenter: "Help Center",
          orderNotFound: "Order Not Found",
          orderNotFoundDescription: "We couldn't find an order with ID: {{orderId}}",
          viewAllOrders: "View All Orders",
          goToHelpCenter: "Go to Help Center",
          status: {
            confirmed: "Confirmed",
            preparing: "Preparing",
            outForDelivery: "Out for Delivery",
            delivered: "Delivered"
          },
          toast: {
            refundRequestPlaceholder: "Refund request would be processed here. Contact support for assistance.",
            liveChatPlaceholder: "Live chat would open here with order context"
          },
          actions: {
            trackOrder: "Track Order",
            contactSupport: "Contact Support",
            viewInvoice: "View Invoice",
            reportIssue: "Report Issue",
            viewOrderDetails: "View Order Details",
            requestRefund: "Request Refund",
            viewOrder: "View Order"
          },
          issues: {
            "late-delivery": {
              title: "Order is Late",
              description: "Your order hasn't arrived within the estimated time",
              solutions: {
                1: "Check the order tracking page for real-time updates",
                2: "Contact the delivery driver if contact information is available",
                3: "Wait an additional 15-20 minutes as delays can occur",
                4: "Contact support if the order is more than 30 minutes late"
              }
            },
            "missing-items": {
              title: "Missing Items",
              description: "Some items from your order are missing",
              solutions: {
                1: "Check your order receipt to verify what was ordered",
                2: "Check if items were delivered separately",
                3: "Contact support immediately with your order number",
                4: "Take photos if possible to help with the investigation"
              }
            },
            "wrong-order": {
              title: "Wrong Order Received",
              description: "You received items different from what you ordered",
              solutions: {
                1: "Keep the incorrect order - you won't be charged for it",
                2: "Contact support immediately with your order number",
                3: "We'll arrange a replacement or full refund",
                4: "You may be eligible for a discount on your next order"
              }
            },
            "quality-issue": {
              title: "Quality Issue",
              description: "Food quality doesn't meet expectations",
              solutions: {
                1: "Contact support within 24 hours of delivery",
                2: "Describe the issue in detail",
                3: "Take photos if possible",
                4: "We'll process a full refund or replacement"
              }
            },
            "payment-issue": {
              title: "Payment Problem",
              description: "Issues with payment or billing",
              solutions: {
                1: "Check your payment method in your profile",
                2: "Verify the charge on your bank statement",
                3: "Contact support if you were charged incorrectly",
                4: "We'll investigate and process a refund if needed"
              }
            },
            "cancel-order": {
              title: "Cancel Order",
              description: "Need to cancel your order",
              solutions: {
                1: "Orders can be cancelled within 5 minutes of placement",
                2: "After 5 minutes, contact support for cancellation",
                3: "If the order is already being prepared, cancellation may not be possible",
                4: "Refunds are processed automatically for cancelled orders"
              }
            }
          }
        },
        help: {
          title: "Help Center",
          subtitle: "Find answers to common questions or contact our support team",
          searchPlaceholder: "Search for help topics, questions, or keywords...",
          browseByCategory: "Browse by Category",
          noResultsFound: "No results found",
          tryDifferentKeywords: "Try searching with different keywords",
          clearSearch: "Clear Search",
          stillNeedHelp: "Still Need Help?",
          supportAvailable: "Our support team is here to assist you 24/7",
          phoneSupport: "Phone Support",
          phoneSupportDescription: "Call us anytime",
          emailSupport: "Email Support",
          emailSupportDescription: "We'll respond within 24 hours",
          liveChat: "Live Chat",
          liveChatDescription: "Available 24/7",
          liveChatPlaceholder: "Live chat would open here",
          startChat: "Start Chat",
          averageResponseTime: "Average response time: Less than 5 minutes",
          quickActions: {
            trackOrder: "Track Your Order",
            trackOrderDescription: "View order status",
            manageAccount: "Manage Account",
            manageAccountDescription: "Update profile & settings",
            contactSupport: "Contact Support",
            contactSupportDescription: "Get help from our team"
          },
          categories: {
            ordering: {
              title: "Ordering",
              description: "Learn how to place and manage orders",
              topics: {
                1: { question: "How do I place an order?", answer: "To place an order, browse restaurants, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order." },
                2: { question: "Can I modify or cancel my order?", answer: "You can modify or cancel your order within 5 minutes of placing it. After that, please contact support for assistance." },
                3: { question: "How do I track my order?", answer: "Go to 'My Orders' in your profile, select the order you want to track, and you'll see real-time updates on your order status." },
                4: { question: "What is the minimum order amount?", answer: "The minimum order amount varies by restaurant, typically ranging from $10 to $15. This information is displayed on each restaurant's page." }
              }
            },
            payments: {
              title: "Payments",
              description: "Payment methods and billing questions",
              topics: {
                1: { question: "What payment methods do you accept?", answer: "We accept all major credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and cash on delivery in select areas." },
                2: { question: "Is my payment information secure?", answer: "Yes, we use industry-standard encryption to protect your payment information. We never store your full card details." },
                3: { question: "Can I get a refund?", answer: "Refunds are processed for cancelled orders, incorrect items, or quality issues. Contact support within 24 hours of delivery for assistance." },
                4: { question: "Why was my payment declined?", answer: "Payment can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please verify your payment method and try again." }
              }
            },
            delivery: {
              title: "Delivery",
              description: "Delivery times, fees, and tracking",
              topics: {
                1: { question: "What are your delivery times?", answer: "Delivery times typically range from 30-60 minutes, depending on the restaurant and your location. Estimated time is shown before checkout." },
                2: { question: "How much is the delivery fee?", answer: "Delivery fees vary by restaurant and distance, typically ranging from $2.99 to $5.99. The exact fee is shown before you place your order." },
                3: { question: "What if my order is late?", answer: "If your order is significantly delayed, contact support. We'll investigate and may provide compensation or a refund." }
              }
            },
            account: {
              title: "Account & Profile",
              description: "Manage your account and preferences",
              topics: {
                1: { question: "How do I update my profile?", answer: "Go to 'Profile' in the menu, then select 'Edit Profile' to update your name, email, phone number, and other information." },
                2: { question: "How do I change my password?", answer: "Go to Profile > Settings > Security to change your password. You'll need to verify your current password first." },
                3: { question: "How do I manage my addresses?", answer: "Navigate to Profile > Addresses to view, add, edit, or delete delivery addresses. Set a default address for faster checkout." },
                4: { question: "How do I save my favorite restaurants?", answer: "Click the heart icon on any restaurant page to add it to your favorites. View all favorites in Profile > Favorites." }
              }
            },
            refunds: {
              title: "Refunds & Returns",
              description: "Refund policy and return process",
              topics: {
                1: { question: "What is your refund policy?", answer: "We offer full refunds for cancelled orders, incorrect items, or quality issues reported within 24 hours of delivery." },
                2: { question: "How long do refunds take?", answer: "Refunds are typically processed within 5-7 business days, depending on your payment method. You'll receive a confirmation email." },
                3: { question: "Can I return food items?", answer: "Due to food safety regulations, we cannot accept returns of food items. However, we'll provide a full refund for quality issues." },
                4: { question: "What if I received the wrong order?", answer: "Contact support immediately with your order number. We'll arrange a replacement or full refund, and you can keep the incorrect order." }
              }
            },
            general: {
              title: "General Questions",
              description: "Other frequently asked questions",
              topics: {
                1: { question: "Do you offer discounts or promotions?", answer: "Yes! Check the 'Offers' section for current promotions, discount codes, and special deals from restaurants." },
                2: { question: "How do I contact customer support?", answer: "You can contact us via phone, email, or live chat. Visit the 'Contact Support' section below for all contact options." },
                3: { question: "Is there a mobile app?", answer: "Yes, our mobile app is available for iOS and Android. Download it from the App Store or Google Play for the best experience." },
                4: { question: "Do you deliver to my area?", answer: "Enter your delivery address to see available restaurants in your area. We're constantly expanding our delivery zones." }
              }
            }
          }
        },
        orderTracking: {
          customer: "Customer",
          restaurant: "Restaurant",
          deliveryPartner: "Delivery Partner",
          orderNotFound: "Order Not Found",
          orderNotFoundDescription: "The order you're looking for doesn't exist.",
          failedToFetchOrder: "Failed to fetch order",
          estimatedDeliveryInMins: "Estimated delivery in {{mins}} minutes",
          loadingOrderDetails: "Loading order details...",
          backToOrders: "Back to Orders",
          orderConfirmed: "Order Confirmed!",
          orderPlacedSuccessfully: "Your order has been placed successfully",
          onTime: "On time",
          orderReadyForPickup: "Order is ready for pickup",
          foodIsCooking: "Food is Cooking",
          learnSafety: "Learn about delivery partner safety",
          deliveryDetailsBanner: "All your delivery details in one place 👇",
          phoneNumberUnavailable: "Phone number not available",
          edit: "Edit",
          deliveryAtLocation: "Delivery at Location",
          addDeliveryAddress: "Add delivery address",
          addDeliveryInstructions: "Add delivery instructions",
          helpDeliveryPartner: "Help your delivery partner find you faster",
          localArea: "Local Area",
          na: "N/A",
          orderReadyAlt: "Order ready",
          foodCookingAlt: "Food cooking",
          orderNumber: "Order #{{id}}",
          cancelOrder: "Cancel order",
          editCustomerNumber: "Edit customer number",
          editCustomerNumberDesc: "Keep the pickup contact updated so the delivery partner can reach you easily.",
          phoneNumber: "Phone number",
          enterPhoneNumber: "Enter phone number",
          deliveryInstructions: "Delivery instructions",
          deliveryInstructionsDesc: "Add a short note for the delivery partner like landmark, gate number, or entry guidance.",
          instructions: "Instructions",
          instructionsPlaceholder: "Example: Ring bell at flat 302, use side gate near the pharmacy.",
          cancellationReasonPlaceholder: "e.g., Changed my mind, Wrong address, etc.",
          cancelling: "Cancelling...",
          confirmCancellation: "Confirm Cancellation",
          status: {
            placed: {
              title: "Order placed",
              subtitle: "Food preparation will begin shortly"
            },
            preparing: {
              title: "Preparing your order",
              subtitle: "Arriving in {{mins}} mins"
            },
            ready: {
              title: "Order is ready",
              subtitle: "Waiting for delivery partner pickup"
            },
            pickup: {
              title: "Order picked up",
              subtitle: "Arriving in {{mins}} mins"
            },
            delivered: {
              title: "Order delivered",
              subtitle: "Enjoy your meal!"
            },
            cancelled: {
              title: "Order cancelled",
              subtitle: "This order has been cancelled"
            }
          },
          toast: {
            orderAlreadyCancelled: "Order is already cancelled",
            cannotCancelDelivered: "Cannot cancel a delivered order",
            callsNotAllowed: "Calls are not allowed for cancelled or delivered orders",
            maskedCallFallback: "Masked call unavailable right now. Falling back to direct call.",
            restaurantPhoneUnavailable: "Restaurant phone number not available",
            connectingMasked: "Connecting via masked number...",
            unableMaskedCall: "Unable to place masked call",
            customerNumberUpdated: "Customer number updated",
            failedToUpdateCustomerNumber: "Failed to update customer number",
            deliveryInstructionsUpdated: "Delivery instructions updated",
            deliveryInstructionsCleared: "Delivery instructions cleared",
            failedToUpdateDeliveryInstructions: "Failed to update delivery instructions",
            provideCancellationReason: "Please provide a reason for cancellation",
            orderCancelledNoRefund: "Order cancelled successfully. No refund required as payment was not made.",
            orderCancelledRefundAfterApproval: "Order cancelled successfully. Refund will be processed after admin approval.",
            failedToCancelOrder: "Failed to cancel order",
            orderIdNotAvailable: "Order ID not available",
            callConnectingToRestaurant: "Call connecting to restaurant",
            failedToInitiateMaskedCall: "Failed to initiate masked call"
          }
        },
        profile: {
          defaultUserName: "User",
          notAvailable: "Not available",
          walletMoney: "{{companyName}} Money",
          yourCoupons: "Your coupons",
          yourCart: "Your cart",
          yourProfile: "Your profile",
          profileCompletion: "{{percent}}% completed",
          vegMode: "Veg Mode",
          on: "ON",
          off: "OFF",
          collections: "Collections",
          yourCollections: "Your collections",
          foodOrders: "Food Orders",
          yourOrders: "Your orders",
          more: "More",
          about: "About",
          sendFeedback: "Send feedback",
          reportSafetyEmergency: "Report a safety emergency",
          settings: "Settings",
          loggingOut: "Logging out...",
          logOut: "Log out",
          vegModeDescription: "Filter restaurants and dishes based on your dietary preferences",
          vegModeOnTitle: "Veg Mode ON",
          vegModeOnDescription: "Show only vegetarian options",
          vegModeOffTitle: "Veg Mode OFF",
          vegModeOffDescription: "Show all options",
          appearance: {
            title: "Appearance",
            description: "Choose your preferred theme",
            value: {
              light: "Light",
              dark: "Dark"
            },
            light: "Light",
            lightDescription: "Default light theme",
            dark: "Dark",
            darkDescription: "Dark theme"
          }
        },
        payments: {
          title: "Payment Methods",
          subtitle: "Manage your payment methods",
          default: "Default",
          expires: "Expires:",
          type: "Type:",
          cardTypeWithCard: "{{type}} Card",
          confirmDelete: "Are you sure you want to delete this payment method?",
          cardTypes: {
            visa: "Visa",
            mastercard: "Mastercard",
            card: "Card"
          },
          add: {
            title: "Add Payment Method"
          },
          edit: {
            title: "Edit Payment Method",
            notFound: "Payment method not found"
          },
          fields: {
            last4Digits: "Last 4 Digits of Card Number *",
            cardholderName: "Cardholder Name *",
            expiryMonth: "Expiry Month *",
            expiryYear: "Expiry Year *",
            cvv: "CVV *"
          },
          placeholders: {
            cardNumber: "1234",
            cardholderName: "John Doe",
            expiryMonth: "12",
            expiryYear: "2025",
            cvv: "123"
          },
          alerts: {
            requiredFields: "Please fill in all required fields",
            last4Digits: "Please enter the last 4 digits of your card",
            validCvv: "Please enter a valid CVV"
          },
          empty: {
            title: "No payment methods saved yet",
            description: "Add your first payment method to get started with orders",
            addFirst: "Add Your First Payment Method"
          },
          actions: {
            addPaymentMethod: "Add Payment Method",
            cancel: "Cancel",
            savePaymentMethod: "Save Payment Method",
            updatePaymentMethod: "Update Payment Method",
            setAsDefault: "Set as Default",
            edit: "Edit",
            delete: "Delete",
            backToPaymentMethods: "Back to Payment Methods"
          }
        },
        favorites: {
          title: "My Favorites",
          na: "N/A",
          restaurantFallback: "Restaurant",
          tabs: {
            restaurants: "Restaurants ({{count}})",
            dishes: "Dishes ({{count}})"
          },
          counts: {
            summary: "{{dishes}} {{dishesLabel}} • {{restaurants}} {{restaurantsLabel}}",
            dish: "dish",
            dishes: "dishes",
            restaurant: "restaurant",
            restaurants: "restaurants"
          },
          confirm: {
            removeRestaurant: "Remove this restaurant from favorites?",
            removeDish: "Remove this dish from favorites?"
          },
          toast: {
            restaurantRemoved: "Restaurant removed from favorites",
            dishRemoved: "Dish removed from favorites"
          },
          empty: {
            noFavorites: "You haven't added any favorites yet",
            noRestaurants: "No restaurants saved yet",
            noDishes: "No dishes saved yet"
          },
          actions: {
            exploreRestaurants: "Explore Restaurants",
            exploreDishes: "Explore Dishes",
            viewRestaurant: "View Restaurant",
            viewDish: "View Dish"
          }
        },
        orderDetailsPage: {
          title: "Order Details",
          loadingOrderDetails: "Loading order details...",
          orderNotFound: "Order not found",
          backToOrders: "Back to Orders",
          restaurantFallback: "Restaurant",
          addressNotAvailable: "Address not available",
          na: "N/A",
          item: "Item",
          customer: "Customer",
          orderWasDelivered: "Order was delivered",
          processing: "Processing",
          orderStatusWithValue: "Order status: {{status}}",
          orderIdLabel: "Order ID: #{{id}}",
          callRestaurantMasked: "Call restaurant via masked number",
          callDeliveryPartnerMasked: "Call delivery partner via masked number",
          billSummary: "Bill Summary",
          itemTotal: "Item total",
          gstGovTaxes: "GST (govt. taxes)",
          deliveryPartnerFee: "Delivery partner fee",
          platformFee: "Platform fee",
          subscriptionOtherFees: "Subscription / other fees",
          free: "Free",
          paid: "Paid",
          savedOnOrder: "You saved ₹{{amount}} on this order!",
          paymentMethod: "Payment method",
          paidViaWithValue: "Paid via: {{method}}",
          paymentDate: "Payment date",
          deliveryAddress: "Delivery address",
          reorder: "Reorder",
          invoice: "Invoice",
          restaurantComplaint: "Restaurant Complaint",
          failedToLoadOrderDetails: "Failed to load order details",
          paymentMethods: {
            cashOnDelivery: "Cash on Delivery",
            wallet: "Wallet",
            online: "Online"
          },
          pdf: {
            summaryAndReceipt: "{{companyName}} Order: Summary and Receipt",
            orderId: "Order ID:",
            orderTime: "Order Time:",
            customerName: "Customer Name:",
            deliveryAddress: "Delivery Address:",
            restaurantName: "Restaurant Name:",
            restaurantAddress: "Restaurant Address:",
            item: "Item",
            quantity: "Quantity",
            unitPrice: "Unit Price",
            totalPrice: "Total Price",
            total: "Total:"
          },
          toast: {
            orderIdCopied: "Order ID copied",
            failedToCopyOrderId: "Failed to copy Order ID",
            orderIdNotAvailable: "Order ID not available",
            callsNotAllowed: "Calls are not allowed for cancelled or delivered orders",
            callConnectingRestaurant: "Call connecting to restaurant",
            callConnectingDeliveryPartner: "Call connecting to delivery partner",
            failedToInitiateMaskedCall: "Failed to initiate masked call",
            summaryDownloaded: "Summary downloaded successfully!",
            failedToDownloadSummary: "Failed to download summary",
            orderIdNotAvailableRefresh: "Order ID not available. Please refresh the page."
          }
        }
      },
      admin: {
        settings: {
          title: "Settings",
          subtitle: "Manage your account settings and preferences",
          changePassword: "Change Password",
          changePasswordDescription: "Update your password to keep your account secure",
          currentPassword: "Current Password",
          currentPasswordPlaceholder: "Enter your current password",
          newPassword: "New Password",
          newPasswordPlaceholder: "Enter your new password",
          confirmPassword: "Confirm New Password",
          confirmPasswordPlaceholder: "Confirm your new password",
          passwordHint: "Password must be at least 6 characters long",
          changingPassword: "Changing Password...",
          changePasswordAction: "Change Password",
          accountSettings: "Account Settings",
          accountSettingsDescription: "Additional account settings and preferences",
          moreSettingsSoon: "More settings options will be available here soon.",
          validation: {
            currentRequired: "Current password is required",
            newRequired: "New password is required",
            minLength: "Password must be at least 6 characters long",
            confirmRequired: "Please confirm your new password",
            mismatch: "Passwords do not match",
            mustDiffer: "New password must be different from current password"
          },
          toast: {
            passwordUpdated: "Password changed successfully",
            passwordUpdateFailed: "Failed to change password"
          }
        },
        coupons: {
          title: "Coupons & Offers",
          subtitle: "Manage admin coupons separately from restaurant-created offers.",
          tabs: {
            adminCoupons: "Admin Coupons",
            restaurantOffers: "Restaurant Offers"
          },
          search: {
            adminPlaceholder: "Search by code, title, or description...",
            restaurantPlaceholder: "Search by restaurant, dish, or coupon code..."
          },
          form: {
            createTitle: "Create Customer Coupon",
            editTitle: "Edit Customer Coupon",
            fields: {
              couponCode: "Coupon Code",
              title: "Title",
              eligibility: "Eligibility",
              discountType: "Discount Type",
              discountPercent: "Discount %",
              discountAmount: "Discount Amount",
              maxDiscountAmount: "Max Discount Amount",
              minOrderValue: "Minimum Order Value",
              validFrom: "Valid From",
              validUntil: "Valid Until",
              description: "Description"
            },
            placeholders: {
              couponCode: "FIRST20",
              title: "20% off on first order",
              discountPercent: "20",
              discountAmount: "100",
              optional: "Optional",
              description: "Shown to users in the cart coupon section"
            },
            cancelEdit: "Cancel Edit",
            saving: "Saving...",
            saveChanges: "Save Changes",
            createCta: "Create Coupon"
          },
          eligibility: {
            firstDeliveredOnly: "First delivered order only",
            firstDelivered: "First delivered order",
            allUsers: "All users"
          },
          discountType: {
            percentage: "Percentage",
            flat: "Flat amount"
          },
          count: {
            coupon: "coupon",
            coupons: "coupons",
            offer: "offer",
            offers: "offers"
          },
          loading: {
            customerCoupons: "Loading customer coupons...",
            restaurantOffers: "Loading restaurant offers..."
          },
          empty: {
            adminCoupons: "No admin coupons created yet",
            restaurantOffers: "No restaurant offers found"
          },
          table: {
            code: "Code",
            title: "Title",
            eligibility: "Eligibility",
            discount: "Discount",
            max: "max",
            minOrder: "Min Order",
            deliveredUses: "Delivered Uses",
            status: "Status",
            validUntil: "Valid Until",
            actions: "Actions",
            noExpiry: "No expiry"
          },
          restaurantTable: {
            title: "Restaurant Offers & Coupons",
            si: "SI",
            restaurant: "Restaurant",
            dish: "Dish",
            couponCode: "Coupon Code",
            discount: "Discount",
            price: "Price",
            status: "Status",
            validUntil: "Valid Until"
          },
          actions: {
            edit: "Edit"
          },
          status: {
            draft: "Draft",
            active: "Active",
            paused: "Paused",
            expired: "Expired",
            cancelled: "Cancelled",
            inactive: "Inactive"
          },
          currency: {
            rs: "Rs"
          },
          common: {
            off: "OFF"
          },
          errors: {
            fetchData: "Failed to fetch coupons data",
            saveCoupon: "Failed to save customer coupon",
            updateStatus: "Failed to update coupon status"
          }
        },
        category: {
          title: {
            page: "Category",
            list: "Category List"
          },
          search: {
            placeholder: "Ex : Categories"
          },
          common: {
            na: "N/A",
            thisCategory: "this category"
          },
          table: {
            sl: "SL",
            image: "Image",
            name: "Title",
            type: "Type",
            status: "Status",
            action: "Action",
            id: "ID"
          },
          status: {
            active: "Active",
            inactive: "Inactive"
          },
          actions: {
            export: "Export",
            addNew: "Add New Category",
            clickToDeactivate: "Click to deactivate",
            clickToActivate: "Click to activate",
            edit: "Edit",
            delete: "Delete",
            close: "Close",
            showResults: "Show results",
            cancel: "Cancel",
            update: "Update",
            create: "Create"
          },
          loading: {
            categories: "Loading categories..."
          },
          empty: {
            noData: "No Data Found",
            noMatch: "No categories match your search"
          },
          export: {
            generatedOn: "Generated on: {{date}}"
          },
          confirm: {
            delete: "Are you sure you want to delete \"{{categoryName}}\"? This action cannot be undone."
          },
          success: {
            statusUpdated: "Category status updated successfully",
            deleted: "Category deleted successfully",
            exported: "PDF exported successfully!",
            updated: "Category updated successfully",
            created: "Category created successfully"
          },
          errors: {
            loginRequired: "Please login to access categories",
            loadFailed: "Failed to load categories",
            authRequired: "Authentication required. Please login again.",
            accessDenied: "Access denied. You do not have permission.",
            endpointNotFound: "Categories endpoint not found. Please check backend server.",
            serverError: "Server error. Please try again later.",
            loadWithStatus: "Error {{status}}: Failed to load categories",
            network: "Cannot connect to server. Please check if backend is running on {{host}}",
            updateStatusFailed: "Failed to update category status",
            deleteFailed: "Failed to delete category",
            exportFailed: "Failed to export PDF",
            invalidFileType: "Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.",
            fileTooLarge: "File size exceeds 5MB limit.",
            saveFailed: "Failed to save category",
            saveWithStatus: "Error {{status}}: Failed to save category"
          },
          filters: {
            title: "Filters",
            modalTitle: "Filters and sorting",
            clearAll: "Clear all",
            sortBy: "Sort by",
            deliveryTime: "Delivery Time",
            restaurantRating: "Restaurant Rating",
            distance: "Distance",
            dishPrice: "Dish Price",
            cuisine: "Cuisine",
            trustMarkers: "Trust Markers",
            tabs: {
              sortBy: "Sort By",
              time: "Time",
              rating: "Rating",
              distance: "Distance",
              dishPrice: "Dish Price",
              cuisine: "Cuisine",
              offers: "Offers",
              trust: "Trust"
            },
            options: {
              relevance: "Relevance",
              priceLowToHigh: "Price: Low to High",
              priceHighToLow: "Price: High to Low",
              ratingHighToLow: "Rating: High to Low",
              ratingLowToHigh: "Rating: Low to High",
              under30: "Under 30 mins",
              under45: "Under 45 mins",
              rated35: "Rated 3.5+",
              rated40: "Rated 4.0+",
              rated45: "Rated 4.5+",
              under1km: "Under 1 km",
              under2km: "Under 2 km",
              under1kmShort: "Under 1km",
              under2kmShort: "Under 2km",
              under200: "Under ₹200",
              under500: "Under ₹500",
              topRated: "Top Rated",
              trustedByUsers: "Trusted by 1000+ users"
            }
          },
          modal: {
            editTitle: "Edit Category",
            createTitle: "Add New Category",
            fields: {
              categoryType: "Category Type *",
              selectCategoryType: "Select category type",
              categoryName: "Category Name *",
              categoryNamePlaceholder: "Enter category name",
              description: "Description",
              descriptionPlaceholder: "Optional description",
              categoryImage: "Category Image",
              categoryPreviewAlt: "Category preview",
              changeImage: "Change Image",
              uploadImage: "Upload Image",
              supportedFormats: "Supported formats: PNG, JPG, JPEG, WEBP (Max 5MB)",
              activeStatus: "Active Status"
            },
            types: {
              starters: "Starters",
              mainCourse: "Main course",
              desserts: "Desserts",
              beverages: "Beverages",
              varieties: "Varieties"
            }
          }
        }
      },
      delivery: {
        changeLanguage: {
          title: "Change language",
          subtitle: "Select your preferred language for the app",
          restartNotice: "The app will refresh to apply the language change.",
          saving: "Saving language..."
        },
        settingsPage: {
          title: "Settings",
          options: {
            notifications: {
              label: "Push Notifications",
              description: "Receive notifications about new orders"
            },
            locationServices: {
              label: "Location Services",
              description: "Allow app to access your location"
            },
            biometricAuth: {
              label: "Biometric Authentication",
              description: "Use fingerprint or face ID to login"
            }
          },
          aria: {
            goBack: "Go back"
          }
        },
        notificationsPage: {
          title: "Notifications",
          newCount: "{{count}} New",
          empty: "No notifications",
          time: {
            minutesAgo: "{{count}} minutes ago",
            hoursAgo: "{{count}} hour ago",
            hoursAgo_plural: "{{count}} hours ago",
            daysAgo: "{{count}} day ago",
            daysAgo_plural: "{{count}} days ago"
          },
          items: {
            newOrderRequest: {
              title: "New Order Request",
              message: "You have a new order request from {{restaurant}}. Order #{{orderId}}"
            },
            orderDelivered: {
              title: "Order Delivered",
              message: "Order #{{orderId}} has been successfully delivered. Payment received: ₹ {{amount}}"
            },
            paymentPending: {
              title: "Payment Pending",
              message: "Payment for Order #{{orderId}} is still pending. Please collect from customer."
            },
            systemUpdate: {
              title: "System Update",
              message: "New features have been added to the delivery app. Check them out!"
            },
            orderCancelled: {
              title: "Order Cancelled",
              message: "Order #{{orderId}} has been cancelled by the customer."
            },
            withdrawalSuccessful: {
              title: "Withdrawal Successful",
              message: "Your withdrawal of ₹ {{amount}} has been processed successfully."
            },
            profileUpdated: {
              title: "Profile Updated",
              message: "Your profile information has been updated successfully."
            }
          },
          aria: {
            goBack: "Go back"
          }
        }
      },
      restaurant: {
        changeLanguage: {
          title: "Change language",
          subtitle: "Select your preferred language for the app",
          restartNotice: "The app will refresh to apply the language change.",
          saving: "Saving language..."
        },
        editRestaurant: {
          title: "Edit Restaurant",
          aria: {
            back: "Go back"
          },
          languages: {
            english: "English",
            bengali: "Bengali - বাংলা",
            arabic: "Arabic - العربية",
            spanish: "Spanish"
          },
          fields: {
            restaurantName: "Restaurant Name",
            restaurantNameWithLang: "Restaurant Name ({{language}})",
            contact: "Contact",
            phoneNumber: "Phone Number",
            address: "Address",
            restaurantLogo: "Restaurant Logo",
            restaurantCover: "Restaurant Cover",
            metaData: "Meta Data",
            title: "Title",
            description: "Description",
            metaImage: "Meta Image"
          },
          placeholders: {
            restaurantName: "Enter restaurant name",
            phoneNumber: "01747410000",
            address: "Enter address",
            metaTitle: "Enter meta title",
            metaDescription: "Enter meta description"
          },
          hints: {
            logo: "JPG, JPEG, PNG Less Than 1MB (Ratio 1:1)",
            cover: "JPG, JPEG, PNG Less Than 1MB (Ratio 2:1)"
          },
          actions: {
            uploadLogo: "Upload Logo",
            uploadCover: "Upload Cover",
            uploadMetaImage: "Upload Meta Image",
            update: "Update"
          },
          alerts: {
            requiredFields: "Please fill in all required fields (Restaurant Name, Address, Phone Number)",
            saveFailed: "Error saving restaurant data. Please try again."
          }
        },
        fssaiDetails: {
          aria: {
            back: "Back"
          },
          restaurantName: "Kadhai Chammach Restaurant",
          location: "By Pass Road (South), Indore",
          warning: {
            title: "FSSAI is expiring in 14 days",
            subtitle: "Update before expiry to keep getting orders"
          },
          fields: {
            registrationNumber: "FSSAI registration number",
            document: "Document",
            validUpto: "Valid up to"
          },
          actions: {
            updateLicense: "Update FSSAI license",
            notRenewed: "Haven't renewed your FSSAI?",
            applyNow: "Apply Now"
          }
        },
        dishRatings: {
          aria: {
            goBack: "Go back"
          },
          restaurantName: "Kadhai Chammach Restaurant",
          restaurantLocation: "Musakhedi, Idrish Nagar, By Pass Road (South), Indore",
          empty: "You haven't received any dish rating yet"
        },
        shareFeedback: {
          title: "Share your feedback",
          aria: {
            close: "Close"
          },
          subtitlePrefix: "Tell us about your",
          subtitleMain: "Overall experience with {{companyName}}",
          scale: {
            veryBad: "Very Bad",
            veryGood: "Very Good",
            ratedPrefix: "You rated your experience",
            ratedSuffix: "."
          },
          actions: {
            continue: "Continue",
            done: "Done"
          },
          thanks: {
            title: "Thanks for your feedback",
            subtitle: "It helps us improve your experience with {{companyName}}."
          },
          toast: {
            saveFailed: "Failed to save feedback, but thank you for your input!"
          }
        },
        fssaiUpdate: {
          title: "Update FSSAI",
          aria: {
            back: "Back"
          },
          fields: {
            registrationNumber: "FSSAI registration number",
            validUpto: "Valid up to",
            uploadLicense: "Upload your FSSAI license"
          },
          placeholders: {
            registrationNumber: "eg. 19138110019201",
            validUpto: "DD-MM-YYYY"
          },
          hints: {
            fileTypes: "jpeg, png, or pdf (up to 5MB)"
          },
          actions: {
            viewGuidelines: "View upload guidelines",
            confirm: "Confirm"
          }
        },
        editAddress: {
          aria: {
            goBack: "Go back"
          },
          title: "Outlet address",
          map: {
            title: "Your outlet location",
            subtitle: "Orders will be picked up from here"
          },
          fields: {
            buildingStreet: "Building / Street",
            floorSuite: "Floor / Suite (Optional)",
            area: "Area",
            city: "City",
            landmark: "Landmark"
          },
          placeholders: {
            addressLine1: "Building name, street etc.",
            addressLine2: "Floor, suite, subunit etc.",
            area: "Area / Locality",
            city: "City",
            landmark: "Famous nearby place"
          },
          actions: {
            updating: "Updating Details...",
            save: "Save Address"
          },
          toast: {
            updated: "Address updated successfully!",
            updateFailed: "Failed to update address",
            updateProfileFailed: "Failed to update profile"
          }
        },
        phoneNumbers: {
          aria: {
            goBack: "Go back"
          },
          title: "Important contacts",
          sections: {
            orderReminder: {
              title: "Order reminder numbers",
              subtitle: "Should always be available for Zomato to reach out for live order support and order reminders.",
              number1: "Order reminder number #1",
              number2: "Order reminder number #2"
            },
            restaurantPage: {
              title: "Restaurant page number",
              subtitle: "Number for Zomato customers to call your restaurant."
            }
          },
          actions: {
            manageStaffContacts: "Manage contact details for your staff",
            cancel: "Cancel",
            save: "Save",
            verify: "Verify"
          },
          editModal: {
            title: "Edit phone number",
            countryCode: "Country code",
            phoneNumber: "Phone number",
            phonePlaceholder: "Enter phone number"
          },
          countryModal: {
            title: "Select country code"
          },
          otpModal: {
            title: "Verify OTP",
            subtitle: "We've sent a 6-digit OTP to",
            resend: "Resend OTP"
          }
        },
        withdrawalHistory: {
          aria: {
            goBack: "Go back"
          },
          title: "Withdrawal History",
          tabs: {
            pending: "Withdrawal Pending",
            successful: "Withdrawal Successful"
          },
          loading: "Loading...",
          labels: {
            requested: "Requested",
            processed: "Processed"
          },
          status: {
            pending: "Pending",
            approved: "Approved",
            processed: "Processed"
          },
          empty: {
            pending: "No pending withdrawal requests",
            successful: "No successful withdrawals"
          },
          common: {
            na: "N/A"
          }
        },
        exploreMore: {
          title: "Explore more",
          common: {
            loading: "Loading...",
            na: "N/A"
          },
          sections: {
            manageOutlet: "Manage outlet",
            settings: "Settings",
            orders: "Orders",
            help: "Help",
            accounting: "Accounting"
          },
          items: {
            outletInfo: "Outlet info",
            outletTimings: "Outlet timings",
            manageStaff: "Manage staff",
            zoneSetup: "Zone Setup",
            deliverySetup: "Delivery setup",
            changeLanguage: "Change language",
            orderHistory: "Order history",
            complaints: "Complaints",
            reviews: "Reviews",
            helpCentre: "Help centre",
            shareFeedback: "Share your feedback",
            payout: "Payout",
            invoices: "Invoices",
            subscription: "Subscription"
          },
          search: {
            placeholder: "Search features...",
            noResultsTitle: "No results found",
            noResultsSubtitle: "Try searching with different keywords",
            idleTitle: "Search for features",
            idleSubtitle: "Type to search for outlet settings, orders, and more"
          },
          profile: {
            title: "My profile",
            loggingOut: "Logging out...",
            logout: "Logout",
            logoutAllDevices: "Logout from all devices",
            restaurantOwner: "Restaurant Owner",
            roleOwner: "OWNER"
          },
          footer: {
            terms: "Terms of Service",
            privacy: "Privacy Policy",
            codeOfConduct: "Code of Conduct"
          },
          aria: {
            goBack: "Go back",
            search: "Search",
            profile: "Profile",
            closeSearch: "Close search",
            clearSearch: "Clear search",
            close: "Close"
          }
        },
        inviteUser: {
          title: "Add user",
          aria: {
            goBack: "Go back",
            photoPreview: "Staff photo preview",
            removePhoto: "Remove photo"
          },
          fields: {
            name: "Name",
            phone: "Phone number",
            email: "Email address",
            photoOptional: "Photo (Optional)"
          },
          placeholders: {
            name: "Enter full name",
            phone: "Enter phone number",
            email: "Enter email address"
          },
          sections: {
            selectRole: "Select user role"
          },
          roles: {
            staff: "staff",
            manager: "manager"
          },
          actions: {
            addByEmail: "Add by email instead",
            addByPhone: "Add by phone instead",
            uploadPhoto: "Upload Photo",
            addUser: "Add user",
            done: "Done"
          },
          validation: {
            phoneRequired: "Phone number is required",
            phoneMinLength: "Phone number must be at least 10 digits",
            phoneMaxLength: "Phone number is too long",
            emailRequired: "Email is required",
            emailInvalid: "Please enter a valid email address",
            nameRequired: "Name is required",
            nameMinLength: "Name must be at least 2 characters",
            invalidServerResponse: "Invalid response from server",
            addFailed: "Failed to add user. Please try again."
          },
          success: {
            managerTitle: "Manager added successfully!",
            staffTitle: "Staff added successfully!",
            description: "{{name}} has been successfully added as {{role}} to your outlet."
          }
        },
        downloadReport: {
          title: "Download report",
          aria: {
            back: "Back"
          },
          banner: {
            generatingFor: "You are generating a report for",
            allOutlets: "All Outlets"
          },
          labels: {
            selectReportView: "Select the report view:",
            selectDataView: "Select view for data:",
            selectDuration: "Select duration for report:"
          },
          reportViews: {
            detailed: "Detailed report",
            item: "Item sales report"
          },
          viewTypes: {
            daily: "DAILY",
            weekly: "WEEKLY",
            monthly: "MONTHLY"
          },
          durations: {
            daily: {
              last7: "Last 7 days",
              last14: "Last 14 days",
              last30: "Last 30 days"
            },
            weekly: {
              last4w: "Last 4 weeks",
              last8w: "Last 8 weeks",
              last12w: "Last 12 weeks"
            },
            monthly: {
              last3m: "Last 3 months",
              last6m: "Last 6 months",
              last12m: "Last 12 months"
            },
            common: {
              custom: "Custom"
            }
          },
          actions: {
            sendEmail: "Send an email"
          },
          success: {
            title: "Report queued",
            subtitle: "We'll email it to you shortly."
          }
        },
        notificationRequest: {
          title: "Notify Customers",
          aria: {
            goBack: "Go back",
            imagePreview: "Preview",
            removeImage: "Remove image",
            deleteRequest: "Delete request"
          },
          common: {
            optional: "optional",
            loading: "Loading..."
          },
          quota: {
            title: "Today's Request Quota",
            subtitle: "Resets at midnight",
            used: "{{used}}/{{limit}} used"
          },
          submit: {
            title: "Submit a Notification Request",
            limitReached: "Daily request limit reached. You can submit again tomorrow.",
            pendingExists: "You already have a pending request. Wait for admin review."
          },
          fields: {
            notificationTitle: "Notification Title",
            description: "Description",
            image: "Image"
          },
          placeholders: {
            title: "e.g. 30% off all items today!",
            description: "Write a clear, attractive message for customers..."
          },
          upload: {
            helpText: "Click to upload - JPG, PNG or WEBP, max 5 MB",
            uploading: "Uploading...",
            uploaded: "Uploaded"
          },
          actions: {
            submitRequest: "Submit Request",
            submitting: "Submitting...",
            imageUploading: "Image uploading..."
          },
          requests: {
            title: "My Requests",
            empty: "No requests submitted yet."
          },
          status: {
            pending: "Pending Review",
            approved: "Approved & Sent",
            rejected: "Rejected"
          },
          pagination: {
            pageOf: "Page {{page}} of {{total}}",
            prev: "Prev",
            next: "Next"
          },
          validation: {
            imageType: "Only JPG, PNG, or WEBP images are allowed.",
            imageSize: "Image must be under 5 MB.",
            noUploadUrl: "No URL returned",
            imageUploadFailed: "Image upload failed. You can still submit without an image.",
            titleDescriptionRequired: "Title and description are required.",
            imageUploading: "Image is still uploading, please wait."
          },
          feedback: {
            submitSuccess: "Request submitted successfully! Admin will review it shortly.",
            submitFailed: "Failed to submit request. Please try again."
          }
        },
        contactDetails: {
          title: "Contact details",
          sections: {
            owner: "Owner",
            relationshipManager: "Zapoo Relationship Manager",
            manager: "Manager",
            staff: "Staff"
          },
          actions: {
            addSomeone: "Add someone",
            addUser: "Add user"
          },
          empty: {
            manager: "No one added as manager yet.",
            staff: "No one added as staff yet."
          },
          confirm: {
            removeUser: "Are you sure you want to remove this user?"
          },
          errors: {
            deleteFailed: "Failed to delete user",
            removeFailed: "Failed to remove user. Please try again."
          },
          common: {
            loading: "Loading...",
            na: "N/A"
          },
          aria: {
            goBack: "Go back",
            ownerProfile: "Owner profile",
            editOwner: "Edit owner",
            rmProfile: "Relationship manager profile",
            callRm: "Call Relationship Manager",
            deleteUser: "Delete user"
          }
        },
        updateBank: {
          title: "Update bank details",
          aria: {
            back: "Back"
          },
          sections: {
            accountInformation: "Account information"
          },
          labels: {
            lastUpdatedOn: "Last updated on {{date}}",
            beneficiaryName: "Beneficiary name",
            accountNumber: "Account number",
            ifscCode: "IFSC code",
            issueHelp: "Have any issue related to bank details?"
          },
          fields: {
            enterBeneficiaryName: "Enter the beneficiary name",
            enterAccountNumber: "Enter the account number",
            confirmAccountNumber: "Confirm account number",
            enterIfsc: "Enter the IFSC"
          },
          actions: {
            editBankDetails: "Edit bank details",
            submit: "Submit"
          },
          validation: {
            beneficiaryRequired: "Beneficiary name is required",
            beneficiaryMinLength: "Beneficiary name must be at least 3 characters",
            beneficiaryMaxLength: "Beneficiary name must be less than 100 characters",
            beneficiaryPattern: "Beneficiary name can only contain letters, spaces, and dots",
            accountRequired: "Account number is required",
            accountDigitsOnly: "Account number must contain only digits",
            accountMinLength: "Account number must be at least 9 digits",
            accountMaxLength: "Account number must be less than 18 digits",
            confirmRequired: "Please confirm your account number",
            accountMismatch: "Account numbers do not match",
            ifscRequired: "IFSC code is required",
            ifscLength: "IFSC code must be exactly 11 characters",
            ifscInvalid: "Invalid IFSC code format (e.g., SBIN0018764)"
          }
        },
        switchOutlet: {
          title: "Switch outlet",
          mappedOutlets: "You are mapped to {{count}} outlet",
          mappedOutlets_plural: "You are mapped to {{count}} outlets",
          sample: {
            name: "Kadhai Chammach Restaurant",
            address: "By Pass Road (South)"
          },
          labels: {
            outletId: "Outlet ID"
          },
          status: {
            offline: "Offline",
            online: "Online"
          },
          helpText: "Couldn't find the outlet you are looking for? Logout and try again with a different account.",
          actions: {
            showOffline: "Show outlets currently offline",
            logout: "Logout",
            loggingOut: "Logging out..."
          },
          aria: {
            goBack: "Go back",
            search: "Search"
          }
        },
        menuDiscountTiming: {
          pageTitles: {
            percentage: "Percentage discount",
            flatPrice: "Flat price",
            default: "Menu discount"
          },
          customerTarget: {
            title: "Customer target",
            allCustomers: "All customers",
            newCustomers: "New customers",
            newCustomersHint: "Customers who haven't ordered in the last 90 days"
          },
          offerTimings: {
            title: "Offer timings"
          },
          days: {
            all: "All days",
            monThu: "Mon - Thu",
            friSun: "Fri - Sun"
          },
          fields: {
            startDate: "Start date",
            targetMealtime: "Target mealtime"
          },
          mealtimes: {
            all: "All mealtimes",
            breakfast: "Breakfast (8 AM - 11 AM)",
            lunch: "Lunch (11 AM - 3 PM)",
            snacks: "Snacks (3 PM - 7 PM)",
            dinner: "Dinner (7 PM - 11 PM)",
            lateNight: "Late night (11 PM - 6 AM)"
          },
          popup: {
            title: "Select target mealtime"
          },
          actions: {
            previewOffer: "Preview offer",
            confirm: "Confirm"
          },
          toast: {
            created: "Offer created successfully!"
          }
        },
        notifications: {
          title: "Notifications",
          empty: "No notifications",
          aria: {
            back: "Back"
          }
        },
        status: {
          title: "Restaurant status",
          mappedRestaurants: "You are mapped to {{count}} restaurant",
          mappedRestaurants_plural: "You are mapped to {{count}} restaurants",
          common: {
            loading: "Loading...",
            restaurant: "Restaurant"
          },
          labels: {
            id: "ID",
            deliveryStatus: "Delivery status",
            currentDeliverySlot: "Current delivery slot",
            todayOff: "Today is Off",
            notConfigured: "Not configured"
          },
          statusText: {
            receiving: "Receiving orders",
            notReceiving: "Not receiving orders"
          },
          actions: {
            details: "Details",
            cancel: "Cancel",
            goToOutletTimings: "Go to Outlet Timings",
            changeOutletTimings: "Change Outlet Timings"
          },
          warnings: {
            outsideTimings: "You are currently outside your scheduled delivery timings."
          },
          dialogs: {
            outletClosed: {
              title: "Outlet Timings Closed"
            },
            outsideTimings: {
              title: "Outside Delivery Timings",
              description: "You are currently outside your scheduled delivery timings. Please change outlet timings to enable delivery status."
            }
          },
          aria: {
            goBack: "Go back",
            exploreMore: "Explore more"
          }
        },
        outletTimings: {
          title: "Outlet timings",
          days: {
            monday: "Monday",
            tuesday: "Tuesday",
            wednesday: "Wednesday",
            thursday: "Thursday",
            friday: "Friday",
            saturday: "Saturday",
            sunday: "Sunday"
          },
          status: {
            open: "Open",
            close: "Close"
          },
          fields: {
            openingTime: "Opening time",
            closingTime: "Closing time"
          },
          placeholders: {
            openingTime: "Select opening time",
            closingTime: "Select closing time"
          },
          labels: {
            current: "Current",
            dayClosed: "This day is closed"
          },
          aria: {
            goBack: "Go back"
          }
        },
        daySlots: {
          description: "Add or modify your restaurant timings here. You can create maximum up to 3 time slots in a day.",
          days: {
            monday: "Monday",
            tuesday: "Tuesday",
            wednesday: "Wednesday",
            thursday: "Thursday",
            friday: "Friday",
            saturday: "Saturday",
            sunday: "Sunday"
          },
          labels: {
            slot: "Slot-{{number}}",
            copyToAllDays: "Copy above timings to all days",
            total: "Total"
          },
          fields: {
            startTime: "Start Time",
            endTime: "End Time"
          },
          placeholders: {
            startTime: "03:45",
            endTime: "02:15"
          },
          actions: {
            okay: "Okay",
            addTimeSlot: "+ Add time slot",
            save: "Save",
            cancel: "Cancel",
            delete: "Delete"
          },
          alerts: {
            maxSlots: "Maximum 3 slots allowed per day",
            minOneSlot: "At least one slot is required",
            saveError: "Error saving slots. Please try again."
          },
          dialog: {
            deleteTitle: "Delete Time Slot",
            deleteDescription: "Are you sure you want to delete this time slot? This action cannot be undone."
          },
          aria: {
            goBack: "Go back",
            deleteSlot: "Delete slot",
            openTimePicker: "Open time picker"
          }
        },
        editOwner: {
          title: "Contact details",
          common: {
            loading: "Loading..."
          },
          fields: {
            name: "Name",
            phone: "Phone number",
            email: "Email"
          },
          placeholders: {
            name: "Enter name",
            phone: "Enter phone number",
            email: "Enter email address"
          },
          actions: {
            editPhoto: "Edit photo",
            deleteAccount: "Delete your Zomato account",
            deleting: "Deleting...",
            confirm: "Confirm",
            cancel: "Cancel",
            saving: "Saving...",
            save: "Save"
          },
          deleteDialog: {
            title: "You are about to delete your Zomato account",
            description: "All information associated with your account will be deleted, and you will lose access to your restaurant permanently. This information cannot be recovered once the account is deleted. Are you sure you want to proceed?"
          },
          alerts: {
            uploadImageFailed: "Failed to upload profile image. Please try again.",
            invalidServerResponse: "Invalid response from server",
            saveFailed: "Failed to save owner details: {{message}}",
            deleteFailed: "Failed to delete account: {{message}}",
            tryAgain: "Please try again."
          },
          aria: {
            goBack: "Go back",
            ownerProfile: "Owner profile"
          }
        },
        challenges: {
          title: "Business Challenges",
          errors: {
            fetchFailed: "Failed to fetch challenges",
            unexpected: "Something went wrong while fetching challenges"
          },
          frequency: {
            daily: "Daily",
            weekly: "Weekly",
            monthly: "Monthly"
          },
          hero: {
            badge: "Growth Booster",
            title: "Unlock Your Potential",
            description: "Complete active challenges to boost your visibility, earn extra commissions, and scale your brand. Rewards are applied automatically when you hit the target.",
            totalRewards: "Total Rewards",
            rank: "Rank"
          },
          filters: {
            all: "All Challenges",
            active: "Active",
            completed: "Completed"
          },
          labels: {
            target: "Target",
            rewardFreeBanner: "Reward: Free Banner (1 day)",
            rewardAmount: "Reward: ₹{{amount}}",
            progress: "Progress",
            expires: "Expires",
            freeBanner: "Free banner (1 day)",
            amountWithCurrency: "₹{{amount}}"
          },
          actions: {
            viewDetails: "View Details",
            gotIt: "Got it"
          },
          empty: {
            title: "No Challenges Found",
            description: "There are no {{filter}} challenges at the moment. Keep an eye out for upcoming growth boosters!"
          },
          details: {
            frequency: "Frequency",
            target: "Target",
            reward: "Reward",
            validity: "Validity",
            currentProgress: "Current progress",
            status: "Status"
          },
          common: {
            dash: "—"
          }
        },
        allOrders: {
          common: {
            restaurant: "Restaurant",
            customer: "customer",
            item: "Item",
            addressNotAvailable: "Address not available"
          },
          reasons: {
            rejectedByRestaurantWithReason: "Rejected by Restaurant: {{reason}}",
            cancelledByWithReason: "Cancelled by {{actor}}: {{reason}}",
            rejectedByRestaurant: "Rejected by Restaurant",
            cancelledByCustomer: "Cancelled by customer"
          },
          labels: {
            showingOrderHistoryFor: "Showing order history for",
            id: "ID",
            orderedBy: "Ordered by",
            moreItems: "more items"
          },
          status: {
            pending: "Pending",
            preparing: "Preparing",
            ready: "Ready",
            outForDelivery: "Out for delivery",
            delivered: "Delivered",
            rejected: "Rejected",
            cancelled: "Cancelled"
          },
          tags: {
            cutlery: "Cutlery",
            expressDelivery: "Express delivery",
            selfDelivery: "Self delivery",
            vegOnly: "Veg only",
            foodRescue: "Food rescue",
            irctc: "IRCTC",
            replacement: "Replacement",
            hospital: "Hospital",
            largeOrder: "Large order"
          },
          search: {
            placeholder: "Search by order ID",
            filterPlaceholder: "Search"
          },
          filter: {
            title: "Filters",
            applied: "{{count}} filter applied",
            applied_plural: "{{count}} filters applied",
            categories: {
              orderStatus: "Order status",
              ratings: "Ratings",
              kptDelay: "KPT delay",
              complaints: "Complaints",
              orderType: "Order type"
            },
            options: {
              preparing: "Preparing",
              ready: "Ready",
              outForDelivery: "Out for delivery",
              delivered: "Delivered",
              rejected: "Rejected",
              cancelled: "Cancelled",
              fiveOrLess: "5★ or less",
              fourOrLess: "4★ or less",
              threeOrLess: "3★ or less",
              twoOrLess: "2★ or less",
              oneStar: "1★",
              zeroToTen: "0-10 mins",
              tenToTwenty: "10-20 mins",
              twentyToThirty: "20-30 mins",
              thirtyPlus: "30+ mins",
              orderDelayed: "Order delayed",
              wrongItems: "Wrong item(s) delivered",
              missingItems: "Item(s) missing or not delivered",
              poorTaste: "Poor taste or quality",
              poorPackaging: "Poor packaging or spillage",
              outOfStock: "Item(s) out of stock",
              notDelivered: "Order not delivered",
              selfDelivery: "Self delivery",
              foodRescue: "Food rescue",
              largeOrder: "Large order",
              vegOnly: "Veg only",
              irctc: "IRCTC",
              replacement: "Replacement",
              hospital: "Hospital"
            }
          },
          dateRange: {
            select: "Select date range",
            options: {
              last2Days: "last 2 days",
              thisWeek: "this week",
              lastWeek: "last week",
              last30Days: "last 30 days",
              customDateRange: "custom date range"
            }
          },
          loading: {
            orders: "Loading orders..."
          },
          errors: {
            fetchOrdersFailed: "Failed to fetch orders",
            loadingOrders: "Error loading orders"
          },
          empty: {
            title: "No orders found",
            subtitle: "Try adjusting your filters"
          },
          actions: {
            clearAll: "Clear all",
            clearFilters: "Clear filters",
            apply: "Apply",
            applying: "Applying...",
            applyingFilters: "Applying filters..."
          },
          toast: {
            orderIdCopied: "Order ID copied to clipboard"
          },
          aria: {
            goBack: "Go back",
            help: "Help",
            filter: "Filter",
            copyOrderId: "Copy order ID",
            close: "Close"
          }
        },
        helpCentre: {
          title: "Help centre",
          howCanWeHelp: "How can we help you",
          searchPlaceholder: "Search by issue",
          empty: "No help topics found matching \"{{query}}\"",
          topics: {
            outletStatus: {
              title: "Outlet online / offline status",
              subtitle: "Current status & details"
            },
            orderIssues: {
              title: "Order related issues",
              subtitle: "Cancellations & delivery related concerns"
            },
            restaurant: {
              title: "Restaurant",
              subtitle: "Timings, contacts, FSSAI, bank details, location etc."
            },
            menu: {
              title: "Menu",
              subtitle: "Items, photos, prices, charges etc."
            },
            payments: {
              title: "Payments",
              subtitle: "Statement of account, invoices etc."
            }
          },
          aria: {
            goBack: "Go back"
          }
        },
        hyperpure: {
          title: "Hyperpure",
          underDevelopment: "This page is under development"
        },
        chooseDiscountType: {
          title: "Choose discount type",
          choosePromo: "Choose your promo discount type",
          goals: {
            "grow-customers": "Grow your customer base",
            "increase-value": "Increase your order value",
            "mealtime-orders": "Get more mealtime orders"
          },
          types: {
            percentage: {
              title: "Percentage discount",
              description: "Create promo discounts like '30% OFF up to ₹75'",
              offLabel: "OFF"
            }
          },
          aria: {
            goBack: "Go back"
          }
        },
        chooseMenuDiscountType: {
          title: "Delight your customers",
          chooseMenuDiscount: "Choose your menu discount type",
          types: {
            freebies: {
              title: "Freebies",
              description: "Give a complimentary dish to delight your high value customers"
            },
            percentage: {
              title: "Percentage discount",
              description: "Flat percentage discount on select items"
            },
            flatPrice: {
              title: "Flat price",
              description: "Select items at fixed prices like ₹99, ₹129, ₹129, etc"
            },
            bogo: {
              title: "BOGO",
              description: "Buy 1 Get 1 free offer on selected items"
            }
          },
          aria: {
            goBack: "Go back"
          }
        },
        hubGrowth: {
          title: "Grow your business",
          buildYourOwn: "Build your own",
          cards: {
            offers: {
              title: "Offers and discounts",
              subtitle: "Start your own offers and grow your business"
            },
            promotedBanners: {
              title: "Promoted Banners",
              subtitle: "Get better visibility on homepage & search"
            },
            notifyCustomers: {
              title: "Notify Customers",
              subtitle: "Request admin to send a push notification to all users"
            },
            businessChallenges: {
              title: "Business Challenges",
              subtitle: "Complete milestones to earn rewards and grow faster"
            }
          },
          aria: {
            openMenu: "Open menu"
          }
        },
        newOrderNotification: {
          title: "New Order!",
          orderNumber: "Order #{{id}}",
          totalAmount: "Total Amount",
          items: "Items:",
          moreItems: "more items",
          deliveryCharge: "Delivery Charge",
          distanceKm: "{{km}} km",
          yourDeliveryEarnings: "Your earnings from delivery",
          deliveryAddress: "Delivery Address",
          address: "Address",
          estimatedDelivery: "Est. delivery: {{mins}} mins",
          note: "Note:",
          payment: {
            cashOnDelivery: "Cash on Delivery",
            onlinePayment: "Online Payment"
          },
          actions: {
            dismiss: "Dismiss",
            viewOrder: "View Order"
          },
          aria: {
            close: "Close"
          }
        },
        subscriptionFeatureOverlay: {
          title: "Premium Feature",
          message: "Upgrade your plan to unlock this growth tool.",
          actions: {
            viewPlans: "View subscription plans",
            goBack: "Go back"
          }
        },
        featureLockedScreen: {
          premiumAccess: "Premium Access",
          lockedTitle: "{{feature}} is locked",
          description: "Your current plan doesn't include this feature. Upgrade to unlock it instantly and continue without limits.",
          upgradeBenefitsTitle: "What you get after upgrade",
          benefits: {
            fullAccess: "• Full access to restricted tools",
            betterVisibility: "• Better growth and analytics visibility",
            continuousAccess: "• Continuous feature access without interruption"
          },
          features: {
            thisFeature: "This Feature",
            order_management: "Order Management",
            menu_control: "Menu Management",
            basic_reports: "Reports",
            marketing_tools: "Marketing Tools",
            advanced_analytics: "Advanced Analytics",
            advanced_marketing_tools: "Advanced Marketing Tools",
            relationship_manager: "Relationship Manager"
          },
          actions: {
            viewPlans: "View subscription plans",
            goBack: "Go back"
          }
        },
        subscriptionExpiryBanner: {
          currentPlan: "current plan",
          titles: {
            trialExpired: "Your trial has expired",
            trialEndingSoon: "Your free trial is ending soon",
            planExpired: "Your plan has expired",
            planEndingSoon: "Your plan is ending soon"
          },
          subtitles: {
            expired: "Buy a subscription plan to continue uninterrupted access.",
            expiresToday: "Expires today ({{planName}}). Buy a plan to continue.",
            expiresTomorrow: "Expires tomorrow ({{planName}}). Buy a plan to continue.",
            expiresInDays: "Expires in {{daysLeft}} days ({{planName}}). Buy a plan to continue."
          },
          actions: {
            buyPlan: "Buy Plan"
          }
        }
      }
    }
  },
  hi: {
    translation: {
      common: {
        language: "भाषा",
        languageNames: {
          en: "अंग्रेज़ी",
          hi: "हिंदी",
          bn: "বাংলা"
        },
        cancel: "रद्द करें",
        save: "सेव करें",
        saving: "सेव हो रहा है...",
        savingLanguage: "भाषा सेव की जा रही है...",
        languageRefreshNotice: "भाषा लागू करने के लिए ऐप रीफ्रेश होगा।",
        languageSettingsDescription: "पूरे ऐप में उपयोग की जाने वाली भाषा चुनें।",
        languageUpdated: "{{language}} अपडेट हो गई",
        languageUpdateFailed: "भाषा प्रेफरेंस अपडेट नहीं हो पाया"
      },
      user: {
        settings: {
          title: "सेटिंग्स",
          notificationsPreferences: "नोटिफिकेशन और प्रेफरेंसेस",
          emailNotifications: "ईमेल नोटिफिकेशन",
          emailNotificationsDescription: "अपने ऑर्डर की अपडेट ईमेल से पाएं",
          pushNotifications: "पुश नोटिफिकेशन",
          pushNotificationsDescription: "अपने डिवाइस पर पुश नोटिफिकेशन पाएं"
        },
        carousel: {
          previous: "पिछला",
          next: "अगला"
        },
        bottomNavigation: {
          delivery: "डिलीवरी",
          under250: "अंडर 250",
          profile: "प्रोफाइल"
        },
        locationDisplay: {
          selectLocation: "लोकेशन चुनें",
          gettingLocation: "लोकेशन प्राप्त की जा रही है...",
          locationUnavailable: "लोकेशन उपलब्ध नहीं",
          locationUnavailableWithError: "लोकेशन उपलब्ध नहीं: {{error}}",
          deliveringTo: "डिलीवर किया जा रहा है",
          select: "चुनें",
          loading: "लोड हो रहा है...",
          currentLocation: "वर्तमान लोकेशन"
        },
        locationExample: {
          basicHookUsage: "बेसिक हुक उपयोग",
          loadingLocation: "लोकेशन लोड हो रही है...",
          area: "एरिया",
          city: "शहर",
          state: "राज्य",
          coordinates: "कोऑर्डिनेट्स",
          notAvailable: "उपलब्ध नहीं",
          getLocation: "लोकेशन प्राप्त करें",
          selectLocation: "लोकेशन चुनें",
          deliveringTo: "डिलीवर किया जा रहा है",
          loading: "लोड हो रहा है...",
          usingLocationDisplayComponent: "LocationDisplay कॉम्पोनेंट का उपयोग",
          fullDisplay: "फुल डिस्प्ले",
          compactDisplayNavbar: "कॉम्पैक्ट डिस्प्ले (नेवबार)",
          fullLocationDisplay: "पूरा लोकेशन डिस्प्ले",
          allowLocation: "लोकेशन अनुमति दें",
          cart: "कार्ट",
          profile: "प्रोफाइल"
        },
        userHome: {
          title: "यूज़र मॉड्यूल",
          subtitle: "यूज़र सेक्शन में आपका स्वागत है"
        },
        auth: {
          signIn: {
            bannerAlt: "फ़ूड बैनर",
            title: "भारत का #1 फ़ूड डिलीवरी ऐप",
            subtitle: "लॉग इन करें या साइन अप करें",
            selectCountryCode: "देश कोड चुनें",
            placeholders: {
              fullName: "अपना पूरा नाम दर्ज करें",
              phoneNumber: "फोन नंबर दर्ज करें",
              email: "अपना ईमेल पता दर्ज करें"
            },
            usePhoneInstead: "इसके बजाय फोन इस्तेमाल करें",
            rememberMe: "तेज़ साइन-इन के लिए मेरा लॉगिन याद रखें",
            creatingAccount: "अकाउंट बनाया जा रहा है...",
            signingIn: "साइन इन हो रहा है...",
            continue: "जारी रखें",
            or: "या",
            signInWithGoogle: "Google से साइन इन करें",
            signInWithEmail: "ईमेल से साइन इन करें",
            disclaimer: "जारी रखकर, आप हमारी इन नीतियों से सहमत हैं",
            termsOfService: "सेवा की शर्तें",
            privacyPolicy: "प्राइवेसी पॉलिसी",
            contentPolicy: "कंटेंट पॉलिसी",
            validation: {
              emailRequired: "ईमेल आवश्यक है",
              emailInvalid: "कृपया वैध ईमेल पता दर्ज करें",
              phoneRequired: "फोन नंबर आवश्यक है",
              phone10Digits: "फोन नंबर 10 अंकों का होना चाहिए",
              phoneRange: "फोन नंबर 7-15 अंकों के बीच होना चाहिए",
              nameRequired: "नाम आवश्यक है",
              nameMin: "नाम कम से कम 2 अक्षरों का होना चाहिए",
              nameMax: "नाम 50 अक्षरों से कम होना चाहिए",
              namePattern: "नाम में केवल अक्षर, स्पेस, हाइफ़न और अपोस्ट्रॉफी हो सकते हैं"
            },
            errors: {
              invalidServerResponse: "सर्वर से अमान्य प्रतिक्रिया मिली। कृपया फिर से प्रयास करें।",
              failedToCompleteSignIn: "साइन-इन पूरा नहीं हो सका। कृपया फिर से प्रयास करें।",
              googleSignInFailed: "Google साइन-इन विफल रहा। कृपया फिर से प्रयास करें।",
              serverError: "सर्वर त्रुटि। कृपया बाद में फिर प्रयास करें।",
              authenticationFailed: "प्रमाणीकरण विफल। कृपया फिर से प्रयास करें।",
              networkError: "नेटवर्क त्रुटि। कृपया अपना कनेक्शन जांचें और फिर से प्रयास करें।",
              invalidCredentials: "अमान्य क्रेडेंशियल्स। कृपया फिर से प्रयास करें।",
              failedToSendOtp: "OTP भेजने में विफल। कृपया फिर से प्रयास करें।",
              firebaseNotInitialized: "Firebase Auth इनिशियलाइज़ नहीं हुआ है। कृपया अपनी Firebase कॉन्फ़िगरेशन जांचें।",
              firebaseConfiguration: "Firebase कॉन्फ़िगरेशन त्रुटि। कृपया सुनिश्चित करें कि आपका डोमेन Firebase Console में अधिकृत है। वर्तमान डोमेन: {{domain}}",
              popupBlocked: "पॉपअप ब्लॉक हो गया। कृपया पॉपअप की अनुमति दें और फिर प्रयास करें।",
              signInCancelled: "साइन-इन रद्द कर दिया गया। कृपया फिर से प्रयास करें।"
            }
          },
          otp: {
            title: "OTP सत्यापन",
            oneLastThing: "एक आखिरी बात",
            namePrompt: "प्रोफाइल पूरा करने के लिए कृपया अपना नाम बताएं",
            enterOtpSentTo: "कृपया {{target}} पर भेजा गया OTP दर्ज करें",
            email: "ईमेल",
            mobileNumber: "मोबाइल नंबर",
            sentTo: "भेजा गया",
            didntReceiveCode: "कोड नहीं मिला?",
            remaining: "शेष",
            resendOtp: "OTP फिर भेजें",
            yourFullName: "आपका पूरा नाम",
            namePlaceholder: "उदा. राहुल शर्मा",
            completeRegistration: "पंजीकरण पूरा करें",
            submit: "सबमिट",
            changeMobileNumber: "मोबाइल नंबर बदलें",
            validation: {
              nameRequired: "नाम आवश्यक है",
              nameMin: "नाम कम से कम 2 अक्षरों का होना चाहिए"
            },
            errors: {
              invalidServerResponse: "सर्वर से अमान्य प्रतिक्रिया मिली",
              failedToVerify: "OTP सत्यापित नहीं हो सका। कृपया फिर से प्रयास करें।",
              verificationStepMissing: "OTP सत्यापन चरण गायब है। कृपया नया OTP अनुरोध करें।",
              failedToCompleteRegistration: "पंजीकरण पूरा नहीं हो सका। कृपया फिर से प्रयास करें।",
              failedToResend: "OTP फिर से भेजने में विफल। कृपया फिर से प्रयास करें।"
            }
          }
        },
        notificationPopup: {
          specialOffer: "स्पेशल ऑफर",
          close: "बंद करें"
        },
        collectionsPage: {
          yourCollections: "आपके कलेक्शंस",
          defaultBookmarks: "बुकमार्क्स",
          delivery: "डिलीवरी",
          dishCount_one: "{{count}} डिश",
          dishCount_other: "{{count}} डिश",
          restaurantCount_one: "{{count}} रेस्टोरेंट",
          restaurantCount_other: "{{count}} रेस्टोरेंट",
          itemCounts: "{{dishes}} {{dishesLabel}} • {{restaurants}} {{restaurantsLabel}}",
          createNew: "नया बनाएं",
          collection: "कलेक्शन",
          createNewCollection: "नया कलेक्शन बनाएं",
          uniqueNamePrompt: "अपने कलेक्शन को एक अलग नाम दें",
          collectionNamePlaceholder: "उदा., वीकेंड फेवरेट्स",
          preview: "प्रीव्यू",
          createCollection: "कलेक्शन बनाएं"
        },
        categoryPage: {
          all: "सभी",
          searchPlaceholder: "रेस्टोरेंट का नाम या डिश...",
          loadingCategories: "कैटेगरी लोड हो रही हैं...",
          noCategoriesAvailable: "कोई कैटेगरी उपलब्ध नहीं",
          filters: "फ़िल्टर्स",
          allRestaurants: "सभी रेस्टोरेंट्स",
          loadingRestaurants: "रेस्टोरेंट्स लोड हो रहे हैं...",
          notAvailable: "उपलब्ध नहीं",
          noRestaurantsForQuery: "\"{{query}}\" के लिए कोई रेस्टोरेंट नहीं मिला",
          noRestaurantsWithFilters: "चुने गए फ़िल्टर्स के साथ कोई रेस्टोरेंट नहीं मिला",
          clearAllFilters: "सभी फ़िल्टर्स साफ करें",
          filtersAndSorting: "फ़िल्टर्स और सॉर्टिंग",
          clearAll: "सभी साफ करें",
          sortBy: "क्रमबद्ध करें",
          deliveryTime: "डिलीवरी समय",
          restaurantRating: "रेस्टोरेंट रेटिंग",
          rated35Plus: "रेटेड 3.5+",
          under200: "₹200 से कम",
          under500: "₹500 से कम",
          priceMatch: "प्राइस मैच",
          trustMarkers: "विश्वास संकेतक",
          topRated: "टॉप रेटेड",
          trustedByUsers: "1000+ यूज़र्स द्वारा भरोसेमंद",
          close: "बंद करें",
          showResults: "रिजल्ट्स दिखाएं",
          filterPills: {
            under30mins: "30 मिनट से कम",
            under45mins: "45 मिनट से कम",
            rating4Plus: "रेटिंग 4.0+",
            rating45Plus: "रेटिंग 4.5+",
            under1km: "1 किमी से कम",
            under2km: "2 किमी से कम",
            flat50off: "फ्लैट 50% OFF",
            under250: "₹250 से कम"
          },
          tabs: {
            sortBy: "सॉर्ट बाय",
            time: "समय",
            rating: "रेटिंग",
            distance: "दूरी",
            dishPrice: "डिश कीमत",
            cuisine: "कुज़ीन",
            offers: "ऑफ़र्स",
            trust: "भरोसा"
          },
          sortOptions: {
            relevance: "प्रासंगिकता",
            priceLowToHigh: "कीमत: कम से ज्यादा",
            priceHighToLow: "कीमत: ज्यादा से कम",
            ratingHighToLow: "रेटिंग: ज्यादा से कम",
            ratingLowToHigh: "रेटिंग: कम से ज्यादा"
          },
          cuisines: {
            chinese: "चाइनीज़",
            american: "अमेरिकन",
            japanese: "जापानी",
            italian: "इटालियन",
            mexican: "मैक्सिकन",
            indian: "भारतीय",
            asian: "एशियन",
            seafood: "सीफूड",
            desserts: "डेज़र्ट्स",
            cafe: "कैफ़े",
            healthy: "हेल्दी"
          }
        },
        searchResults: {
          matchingDishesAndRestaurants: "मेल खाते डिश और रेस्टोरेंट्स",
          dishWithRestaurant: "डिश · {{restaurant}}",
          restaurantFallback: "रेस्टोरेंट",
          closed: "बंद",
          noMatchesFound: "कोई मैच नहीं मिला।"
        },
        under250: {
          title: "अंडर 250",
          bannerTitle: "मॉडर्न और ट्रेंडी",
          bannerAlt: "अंडर 250 बैनर",
          sort: "सॉर्ट",
          apply: "लागू करें",
          add: "जोड़ें",
          viewFullMenu: "पूरा मेन्यू देखें",
          bestPrice: "बेस्ट प्राइस",
          noRestaurantsUnder250: "₹250 से कम डिश वाले रेस्टोरेंट नहीं मिले।",
          noRestaurantsWithFilters: "चुने गए फ़िल्टर्स से कोई रेस्टोरेंट मैच नहीं हुआ।",
          itemDescriptionFallback: "{{restaurant}} से {{item}}",
          sortOptions: {
            deliveryTimeLowToHigh: "डिलीवरी समय: कम से ज़्यादा",
            distanceLowToHigh: "दूरी: पास से दूर"
          }
        },
        home: {
          exploreMoreHeading: "और देखें",
          searchPlaceholderBurger: "\"बर्गर\" खोजें",
          searchPlaceholderBiryani: "\"बिरयानी\" खोजें",
          searchPlaceholderPizza: "\"पिज़्ज़ा\" खोजें",
          searchPlaceholderDesserts: "\"डेज़र्ट\" खोजें",
          searchPlaceholderChinese: "\"चाइनीज़\" खोजें",
          searchPlaceholderThali: "\"थाली\" खोजें",
          searchPlaceholderMomos: "\"मोमोज\" खोजें",
          searchPlaceholderDosa: "\"डोसा\" खोजें",
          voiceNotSupported: "इस ब्राउज़र में स्पीच रिकग्निशन समर्थित नहीं है।",
          listening: "सुन रहे हैं...",
          searchingFor: "\"{{text}}\" खोजा जा रहा है",
          microphoneDenied: "माइक्रोफोन एक्सेस अस्वीकृत है। कृपया ब्राउज़र सेटिंग्स में सक्षम करें।",
          couldNotHear: "हम आपकी आवाज़ नहीं सुन पाए। कृपया फिर कोशिश करें।",
          vegMode: "मोड",
          orderNow: "अभी ऑर्डर करें",
          seeAll: "सभी देखें",
          noCategories: "कोई कैटेगरी उपलब्ध नहीं है",
          filters: "फ़िल्टर्स",
          handpickedForYou: "आपके लिए चुना गया",
          topRestaurants: "टॉप रेस्टोरेंट्स",
          loadingRestaurants: "रेस्टोरेंट्स लोड हो रहे हैं...",
          loading: "लोड हो रहा है...",
          showResults: "रिजल्ट्स दिखाएं",
          select: "चुनें",
          location: "लोकेशन",
          goToImage: "इमेज {{index}} पर जाएं",
          inTheSpotlight: "मुख्य आकर्षण",
          restaurantsDeliveringToYou: "{{count}} रेस्टोरेंट्स आपके लिए डिलीवर कर रहे हैं",
          featured: "फीचर्ड",
          removeFromFavorites: "फेवरेट्स से हटाएं",
          addToFavorites: "फेवरेट्स में जोड़ें",
          byRatings: "{{value}} द्वारा",
          allCategories: "सभी कैटेगरी",
          close: "बंद करें",
          addedToBookmark: "बुकमार्क में जोड़ दिया गया",
          exploreItems: {
            offers: "ऑफर्स",
            gourmet: "गौर्मे",
            topRestaurants: "टॉप रेस्टोरेंट्स",
            collections: "कलेक्शन्स"
          },
          filterTabs: {
            sortBy: "सॉर्ट बाय",
            time: "समय",
            rating: "रेटिंग",
            distance: "दूरी",
            dishPrice: "डिश प्राइस",
            cuisine: "क्यूज़ीन",
            offers: "ऑफर्स",
            trust: "ट्रस्ट"
          },
          sortOptions: {
            relevance: "प्रासंगिकता",
            priceLowToHigh: "कीमत: कम से ज़्यादा",
            priceHighToLow: "कीमत: ज़्यादा से कम",
            ratingHighToLow: "रेटिंग: ज़्यादा से कम",
            ratingLowToHigh: "रेटिंग: कम से ज़्यादा"
          },
          quickFilters: {
            under30Mins: "30 मिनट से कम",
            under45Mins: "45 मिनट से कम",
            under1Km: "1 किमी से कम",
            under2Km: "2 किमी से कम"
          },
          cuisineOptions: {
            chinese: "चाइनीज़",
            american: "अमेरिकन",
            japanese: "जापानी",
            italian: "इटालियन",
            mexican: "मैक्सिकन",
            indian: "भारतीय",
            asian: "एशियन",
            seafood: "सीफूड",
            desserts: "डेज़र्ट्स",
            cafe: "कैफ़े",
            healthy: "हेल्दी"
          },
          fallbacks: {
            deliveryTime2530: "25-30 मिनट",
            deliveryTime2025: "20-25 मिनट",
            distance1_2km: "1.2 किमी",
            multiCuisine: "मल्टी-क्यूज़ीन",
            specialSuffix: "स्पेशल",
            specialDish: "स्पेशल डिश"
          },
          filterModal: {
            title: "फ़िल्टर्स और सॉर्टिंग",
            clearAll: "सब साफ करें",
            close: "बंद करें",
            sections: {
              sortBy: "सॉर्ट बाय",
              deliveryTime: "डिलीवरी समय",
              restaurantRating: "रेस्टोरेंट रेटिंग",
              distance: "दूरी",
              dishPrice: "डिश प्राइस",
              cuisine: "क्यूज़ीन",
              trustMarkers: "ट्रस्ट मार्कर्स",
              offers: "ऑफर्स"
            },
            options: {
              under30Mins: "30 मिनट से कम",
              under45Mins: "45 मिनट से कम",
              rated35Plus: "रेटेड 3.5+",
              rated40Plus: "रेटेड 4.0+",
              rated45Plus: "रेटेड 4.5+",
              under1Km: "1 किमी से कम",
              under2Km: "2 किमी से कम",
              under200: "₹200 से कम",
              under500: "₹500 से कम",
              topRated: "टॉप रेटेड",
              trustedByUsers: "1000+ यूज़र्स का भरोसा",
              restaurantsWithOffers: "ऑफर वाले रेस्टोरेंट्स"
            }
          },
          vegPopup: {
            title: "वेज डिशेज़ देखें",
            allRestaurants: "सभी रेस्टोरेंट्स",
            pureVegOnly: "सिर्फ शुद्ध वेज रेस्टोरेंट्स",
            apply: "लागू करें",
            moreSettings: "और सेटिंग्स"
          },
          switchOffPopup: {
            title: "Veg Mode बंद करें?",
            description: "आपको सभी रेस्टोरेंट्स दिखेंगे, जिनमें नॉन-वेज डिशेज़ वाले भी शामिल हैं",
            switchOff: "बंद करें",
            keepUsing: "इसी मोड में रहें"
          },
          vegLoading: {
            exploreVeg: "सभी रेस्टोरेंट्स से वेज डिशेज़ देखें"
          },
          switchingOff: {
            title: "बंद किया जा रहा है",
            subtitle: "आपके लिए Veg Mode"
          },
          manageCollections: {
            title: "कलेक्शन्स मैनेज करें",
            bookmarks: "बुकमार्क्स",
            bookmarksCount_one: "{{count}} रेस्टोरेंट",
            bookmarksCount_other: "{{count}} रेस्टोरेंट्स",
            createNew: "नया कलेक्शन बनाएं",
            done: "Done"
          },
          gstDialog: {
            title: "GST विवरण",
            description: "खाने, डिलीवरी और प्लेटफ़ॉर्म चार्ज पर सरकार द्वारा लिए गए टैक्स।",
            foodPriceGst: "फूड प्राइस GST (5%)",
            onAmountAfterDiscount: "डिस्काउंट के बाद {{amount}} पर",
            deliveryFeeGst: "डिलीवरी फी GST (18%)",
            platformFeeGst: "प्लेटफ़ॉर्म फी GST (18%)",
            onAmount: "{{amount}} पर",
            totalGst: "कुल GST"
          },
          restaurantDetails: {
            loadingRestaurant: "रेस्टोरेंट लोड हो रहा है...",
            connectionError: "कनेक्शन एरर",
            restaurantNotFound: "रेस्टोरेंट नहीं मिला",
            error: "त्रुटि",
            backendRunningAt: "सुनिश्चित करें कि बैकएंड सर्वर {{url}} पर चल रहा है",
            goBack: "वापस जाएं",
            search: "खोजें",
            searchForDishes: "डिश खोजें...",
            unknownRestaurant: "अज्ञात रेस्टोरेंट",
            outOfDeliveryRangeBadge: "डिलीवरी रेंज से बाहर — ऑर्डर करने के लिए पता बदलें",
            byReviews: "{{count}}+ द्वारा",
            fallbackDistance: "1.2 किमी",
            fallbackLocation: "लोकेशन",
            fallbackDeliveryTime: "25-30 मिनट",
            fallbackRestaurantInitial: "R",
            filters: "फ़िल्टर्स",
            veg: "वेज",
            nonVeg: "नॉन-वेज",
            unnamedSection: "बिना नाम का सेक्शन",
            recommendedForYou: "आपके लिए रिकमेंडेड",
            noDishRecommended: "कोई डिश रिकमेंड नहीं है",
            subsection: "सबसेक्शन",
            mustTry: "ज़रूर ट्राई करें",
            requested: "रिक्वेस्टेड",
            highlyReordered: "बहुत बार रीऑर्डर किया गया",
            noImage: "कोई इमेज नहीं",
            add: "जोड़ें",
            outOfDeliveryRange: "डिलीवरी रेंज से बाहर",
            menu: "मेन्यू",
            largeOrderMenu: "लार्ज ऑर्डर मेन्यू",
            largeOrderComingSoon: "लार्ज ऑर्डर विकल्प जल्द आ रहे हैं",
            close: "बंद करें",
            filtersAndSorting: "फ़िल्टर्स और सॉर्टिंग",
            sortBy: "सॉर्ट बाय:",
            priceLowToHigh: "कीमत - कम से ज़्यादा",
            priceHighToLow: "कीमत - ज़्यादा से कम",
            vegNonVegPreference: "वेज/नॉन-वेज पसंद:",
            topPicks: "टॉप पिक्स:",
            dietaryPreference: "डाइटरी पसंद:",
            spicy: "मसालेदार",
            clearAll: "सब साफ करें",
            apply: "लागू करें",
            allDeliveryOutletsFor: "इनके लिए सभी डिलीवरी आउटलेट्स",
            nearestAvailableOutlet: "सबसे नज़दीकी उपलब्ध आउटलेट",
            noOutletsAvailable: "कोई आउटलेट उपलब्ध नहीं",
            seeAllOutlets: "सभी {{count}} आउटलेट्स देखें",
            manageCollections: "कलेक्शन्स मैनेज करें",
            bookmarks: "बुकमार्क्स",
            bookmarksSummary: "{{dishes}} डिश • {{restaurants}} रेस्टोरेंट",
            createNewCollection: "नया कलेक्शन बनाएं",
            done: "Done",
            noImageAvailable: "कोई इमेज उपलब्ध नहीं",
            notEligibleForCoupons: "कूपन के लिए योग्य नहीं",
            addItem: "आइटम जोड़ें",
            offersAt: "{{restaurant}} पर ऑफर्स",
            goldExclusiveOffer: "गोल्ड एक्सक्लूसिव ऑफर",
            freeDeliveryAbove99: "₹99 से ऊपर फ्री डिलीवरी",
            joinGoldToUnlock: "अनलॉक करने के लिए गोल्ड जॉइन करें",
            addGold: "गोल्ड जोड़ें - ₹1",
            restaurantCoupons: "रेस्टोरेंट कूपन",
            useCode: "कोड उपयोग करें {{code}}",
            termsApply: "नियम और शर्तें लागू",
            removeFromCollection: "कलेक्शन से हटाएं",
            addToCollection: "कलेक्शन में जोड़ें",
            shareThisRestaurant: "इस रेस्टोरेंट को शेयर करें",
            disclaimer: "मेन्यू आइटम, कीमत, फोटो और विवरण सीधे रेस्टोरेंट द्वारा सेट किए जाते हैं। कोई गलत जानकारी दिखे तो कृपया हमें रिपोर्ट करें।",
            multiCuisine: "मल्टी-क्यूज़ीन",
            specialDish: "स्पेशल डिश",
            thisRestaurant: "यह रेस्टोरेंट",
            shareRestaurantText: "{{company}} पर {{restaurant}} देखें! {{url}}",
            shareDishText: "{{restaurant}} से {{dish}} देखें! {{url}}",
            toast: {
              loginToAddItems: "कार्ट में आइटम जोड़ने के लिए लॉगिन करें",
              outsideServiceZone: "आप सर्विस ज़ोन से बाहर हैं। कृपया सर्विस एरिया के अंदर लोकेशन चुनें।",
              restaurantOutOfRange: "यह रेस्टोरेंट आपके वर्तमान पते पर डिलीवर नहीं करता। ऑर्डर के लिए लोकेशन बदलें।",
              itemInfoMissing: "आइटम जानकारी नहीं मिली। कृपया पेज रिफ्रेश करें।",
              restaurantInfoMissingRefresh: "रेस्टोरेंट जानकारी नहीं मिली। कृपया पेज रिफ्रेश करें।",
              restaurantIdMissing: "रेस्टोरेंट ID नहीं मिली। कृपया पेज रिफ्रेश करें।",
              cannotAddDifferentRestaurant: "अलग रेस्टोरेंट से आइटम नहीं जोड़ सकते। पहले कार्ट साफ करें।",
              restaurantInfoMissing: "रेस्टोरेंट जानकारी नहीं मिली",
              dishInfoMissing: "डिश जानकारी नहीं मिली",
              dishRemoved: "डिश फेवरेट्स से हटाई गई",
              dishAdded: "डिश फेवरेट्स में जोड़ दी गई",
              restaurantDataUnavailable: "रेस्टोरेंट डेटा उपलब्ध नहीं",
              restaurantRemovedFromCollection: "रेस्टोरेंट कलेक्शन से हटाया गया",
              restaurantAddedToCollection: "रेस्टोरेंट कलेक्शन में जोड़ दिया गया",
              restaurantShared: "रेस्टोरेंट सफलतापूर्वक शेयर हुआ",
              dishShared: "डिश सफलतापूर्वक शेयर हुई",
              linkCopied: "लिंक क्लिपबोर्ड में कॉपी हो गया!",
              copyFailed: "लिंक कॉपी नहीं हो सका"
            }
          }
        },
        accessibility: {
          title: "सुगम्यता",
          hero: {
            title: "ऐप को अधिक सुलभ बनाएं",
            description: "अपने अनुभव को अपनी जरूरतों और प्राथमिकताओं के अनुसार कस्टमाइज़ करें।"
          },
          options: {
            largeText: {
              label: "बड़ा टेक्स्ट",
              description: "बेहतर पढ़ने के लिए टेक्स्ट आकार बढ़ाएं"
            },
            highContrast: {
              label: "हाई कॉन्ट्रास्ट",
              description: "बेहतर दृश्यता के लिए कॉन्ट्रास्ट बढ़ाएं"
            },
            screenReaderSupport: {
              label: "स्क्रीन रीडर सपोर्ट",
              description: "स्क्रीन रीडर्स के लिए अनुकूलित करें"
            },
            reduceMotion: {
              label: "मोशन कम करें",
              description: "एनीमेशन और ट्रांज़िशन कम करें"
            }
          },
          needMoreHelp: {
            title: "और मदद चाहिए?",
            description: "अगर आपको अतिरिक्त एक्सेसिबिलिटी फीचर्स चाहिए या सुझाव हैं, तो हमारी सपोर्ट टीम से संपर्क करें।",
            contactSupport: "सपोर्ट से संपर्क करें"
          }
        },
        coupons: {
          title: "आपके कूपन",
          empty: {
            title: "कोई कूपन नहीं मिला",
            description: "ऑर्डर करने के बाद मैप स्क्रीन पर छिपे कूपन खोजें"
          }
        },
        trackingPage: {
          restaurantName: "सागर रेस्टोरेंट",
          orderPlaced: "ऑर्डर प्लेस हो गया",
          foodPreparationSoon: "भोजन की तैयारी जल्द शुरू होगी",
          arrivingIn: "पहुंचने में",
          arrivalMins: "{{mins}} मिनट",
          distanceAway: "{{km}} किमी दूर",
          foodCooking: "भोजन बन रहा है",
          deliveryPartnerSafety: "डिलीवरी पार्टनर सुरक्षा के बारे में जानें",
          deliveryDetailsBanner: "आपकी डिलीवरी डिटेल्स एक ही जगह 👋",
          contactName: "अजय पंचाल",
          edit: "संपादित करें",
          deliveryAtLocation: "लोकेशन पर डिलीवरी",
          deliveryAddressSample: "X2RJ+QHR, देवास, मध्य प्रदेश 45..."
        },
        navbar: {
          loading: "लोड हो रहा है...",
          select: "चुनें",
          location: "लोकेशन",
          wallet: "वॉलेट",
          cart: "कार्ट",
          pointsTitle: "{{points}} पॉइंट्स",
          menu: {
            cart: "आपका कार्ट",
            profile: "प्रोफाइल",
            myOrders: "मेरे ऑर्डर्स",
            offers: "ऑफर्स",
            help: "मदद",
            signOut: "साइन आउट"
          }
        },
        stickyCart: {
          restaurant: "रेस्टोरेंट",
          viewMenu: "मेन्यू देखें",
          viewCart: "कार्ट देखें",
          itemsCount_one: "{{count}} आइटम",
          itemsCount_other: "{{count}} आइटम"
        },
        notifications: {
          title: "नोटिफिकेशन्स",
          promotionsAndOffers: "प्रमोशन्स और ऑफर्स",
          ordersAndUpdates: "ऑर्डर्स और अपडेट्स",
          emptyTitle: "कोई नोटिफिकेशन नहीं",
          emptyDescription: "आप पूरी तरह अपडेटेड हैं!",
          time: {
            justNow: "अभी",
            minutesAgo: "{{count}}मि पहले",
            hoursAgo: "{{count}}घं पहले"
          },
          sample: {
            orderConfirmedTitle: "ऑर्डर कन्फर्म हुआ",
            orderConfirmedMessage: "आपका ऑर्डर #12345 कन्फर्म हो गया है और तैयार किया जा रहा है",
            twoMinutesAgo: "2 मिनट पहले",
            specialOfferTitle: "स्पेशल ऑफर",
            specialOfferMessage: "INR 500 से ऊपर अगले ऑर्डर पर 50% छूट पाएं",
            oneHourAgo: "1 घंटा पहले",
            newRestaurantTitle: "नया रेस्टोरेंट जुड़ा",
            newRestaurantMessage: "अपने क्षेत्र में नए इतालवी रेस्टोरेंट को देखें",
            threeHoursAgo: "3 घंटे पहले",
            orderDeliveredTitle: "ऑर्डर डिलीवर हुआ",
            orderDeliveredMessage: "आपका ऑर्डर #12340 सफलतापूर्वक डिलीवर हो गया",
            yesterday: "कल",
            paymentFailedTitle: "पेमेंट फेल हुआ",
            paymentFailedMessage: "ऑर्डर #12338 के लिए आपका भुगतान विफल रहा। कृपया फिर कोशिश करें",
            twoDaysAgo: "2 दिन पहले",
            weekendSpecialTitle: "वीकेंड स्पेशल",
            weekendSpecialMessage: "इस वीकेंड सभी ऑर्डर्स पर फ्री डिलीवरी का आनंद लें",
            threeDaysAgo: "3 दिन पहले"
          }
        },
        offers: {
          bannerAlt: "बेहतरीन ऑफर्स",
          loading: "ऑफर्स लोड हो रहे हैं...",
          retry: "फिर से कोशिश करें",
          empty: "फिलहाल कोई ऑफर उपलब्ध नहीं है",
          errorFallback: "ऑफर्स लोड नहीं हो सके"
        },
        top10: {
          bannerAlt: "टॉप रेस्टोरेंट्स",
          title: "टॉप रेस्टोरेंट्स",
          subtitle: "आपके क्षेत्र के सबसे पसंदीदा रेस्टोरेंट्स",
          loading: "टॉप रेस्टोरेंट्स लोड हो रहे हैं...",
          retry: "फिर से कोशिश करें",
          empty: "फिलहाल कोई टॉप रेस्टोरेंट उपलब्ध नहीं है",
          errorFallback: "टॉप रेस्टोरेंट्स लोड नहीं हो सके"
        },
        gourmet: {
          bannerAlt: "गौर्मे फूड",
          title: "प्रीमियम गौर्मे रेस्टोरेंट्स",
          subtitle: "बेहतरीन व्यंजन आपके दरवाजे तक",
          count: "{{count}} गौर्मे रेस्टोरेंट्स",
          loading: "गौर्मे रेस्टोरेंट्स लोड हो रहे हैं...",
          retry: "फिर से कोशिश करें",
          empty: "फिलहाल कोई गौर्मे रेस्टोरेंट उपलब्ध नहीं है",
          errorFallback: "गौर्मे रेस्टोरेंट्स लोड नहीं हो सके"
        },
        orders: {
          title: "आपके ऑर्डर्स",
          searchPlaceholder: "रेस्टोरेंट या डिश से खोजें",
          viewMenu: "मेन्यू देखें",
          viewDetails: "डिटेल्स देखें",
          reorder: "फिर से ऑर्डर करें",
          youRated: "आपने रेट किया",
          rateOrder: "ऑर्डर रेट करें",
          orderPlacedOn: "ऑर्डर किया गया",
          deliveredOn: "डिलीवर हुआ",
          payment: "भुगतान:",
          locationNotAvailable: "लोकेशन उपलब्ध नहीं",
          deliveryLabel: "डिलीवरी",
          noItemsFound: "कोई आइटम नहीं मिला",
          itemFallback: "आइटम",
          each: "प्रति",
          optional: "वैकल्पिक",
          refundInfo: "रिफंड 24-48 घंटों में प्रोसेस होगा",
          countdownRemaining_one: "{{count}} मिनट बाकी",
          countdownRemaining_other: "{{count}} मिनट बाकी",
          paymentMethod: {
            cashOnDelivery: "कैश ऑन डिलीवरी",
            wallet: "वॉलेट",
            online: "ऑनलाइन",
            na: "N/A"
          },
          share: {
            text: "{{companyName}} पर {{restaurant}} देखें।\nलोकेशन: {{location}}\n{{companyName}} ऐप में इस रेस्टोरेंट से फिर ऑर्डर करें।"
          },
          menu: {
            shareRestaurant: "रेस्टोरेंट शेयर करें",
            orderDetails: "ऑर्डर डिटेल्स"
          },
          empty: {
            noOrders: "आपने अभी तक कोई ऑर्डर नहीं किया है",
            startOrdering: "ऑर्डर शुरू करें",
            noSearchResults: "आपकी खोज से मेल खाते ऑर्डर नहीं मिले"
          },
          error: {
            failedToLoad: "ऑर्डर्स लोड नहीं हो सके",
            loginRequired: "ऑर्डर्स देखने के लिए लॉगिन करें"
          },
          toast: {
            restaurantInfoMissing: "रेस्टोरेंट जानकारी उपलब्ध नहीं",
            restaurantCopied: "रेस्टोरेंट डिटेल्स कॉपी हो गई",
            sharingNotSupported: "इस डिवाइस पर शेयरिंग सपोर्ट नहीं है",
            shareFailed: "रेस्टोरेंट शेयर नहीं हो पाया"
          },
          summary: {
            subtotal: "सबटोटल",
            deliveryFee: "डिलीवरी फी",
            tax: "टैक्स",
            discount: "छूट",
            couponApplied: "कूपन लागू",
            total: "कुल"
          },
          status: {
            deliveredWithIcon: "✓ डिलीवर हुआ",
            restaurantCancelledWithIcon: "✗ रेस्टोरेंट ने कैंसिल किया",
            cancelledByYouWithIcon: "✗ आपने कैंसिल किया",
            cancelledWithIcon: "✗ कैंसिल",
            restaurantCancelled: "रेस्टोरेंट कैंसिल्ड",
            paymentFailed: "पेमेंट फेल",
            orderDelivered: "ऑर्डर डिलीवर हुआ",
            preparing: "तैयार हो रहा है",
            outForDelivery: "डिलीवरी के लिए निकला",
            orderConfirmed: "ऑर्डर कन्फर्म"
          },
          rating: {
            title: "अपने ऑर्डर को रेट करें",
            orderLabel: "ऑर्डर",
            experienceQuestion: "आपका अनुभव कैसा रहा?",
            poor: "खराब",
            average: "औसत",
            excellent: "बेहतरीन",
            shareFeedback: "अपना फीडबैक साझा करें",
            feedbackPlaceholder: "इस ऑर्डर के बारे में आपको क्या अच्छा या खराब लगा? अपना अनुभव लिखें...",
            feedbackHint: "आपका फीडबैक हमारी सेवा बेहतर करने में मदद करता है",
            submitting: "सबमिट हो रहा है...",
            submit: "रेटिंग सबमिट करें",
            selectToContinue: "आगे बढ़ने के लिए रेटिंग चुनें",
            selectFirst: "पहले रेटिंग चुनें",
            thanks: "आपकी रेटिंग के लिए धन्यवाद! 🎉",
            submitFailed: "रेटिंग सबमिट नहीं हो पाई। कृपया फिर कोशिश करें।",
            legend: {
              five: "⭐⭐⭐⭐⭐ बेहतरीन!",
              four: "⭐⭐⭐⭐ बहुत अच्छा!",
              three: "⭐⭐⭐ अच्छा",
              two: "⭐⭐ ठीक-ठाक",
              one: "⭐ खराब"
            }
          }
        },
        cart: {
          error: {
            title: "कार्ट एरर",
            description: "कार्ट सुविधा उपलब्ध नहीं है। कृपया पेज रीफ्रेश करें।",
            goHome: "होम पर जाएं"
          },
          paymentOptions: {
            razorpay: {
              label: "रेज़रपे",
              description: "तुरंत ऑनलाइन भुगतान करें"
            },
            wallet: {
              label: "वॉलेट",
              description: "अपने वॉलेट बैलेंस का उपयोग करें",
              balanceAvailable: "उपलब्ध बैलेंस: Rs {{amount}}"
            },
            cash: {
              label: "कैश ऑन डिलीवरी",
              description: "ऑर्डर आने पर भुगतान करें"
            }
          }
        },
        orderHelp: {
          na: "N/A",
          title: "Order Help",
          orderWithId: "Order {{id}}",
          orderSummary: "Order Summary",
          orderId: "Order ID",
          placedOn: "Placed On",
          totalAmount: "Total Amount",
          items: "Items",
          itemsCount_one: "{{count}} item",
          itemsCount_other: "{{count}} items",
          deliveryAddress: "Delivery Address",
          whatCanWeHelpWith: "What can we help you with?",
          whatToDo: "What to do:",
          quickActions: "Quick Actions",
          trackOrderDescription: "View real-time status",
          viewInvoiceDescription: "Download receipt",
          contactSupportDescription: "Get help now",
          contactSupportForOrder: "Contact Support for This Order",
          supportReadyDescription: "Our support team is ready to help you with order {{id}}",
          phoneSupport: "Phone Support",
          mentionOrder: "Mention order {{id}}",
          emailSupport: "Email Support",
          includeOrderInSubject: "Include order {{id}} in subject",
          startLiveChat: "Start Live Chat",
          backToAllOrders: "Back to All Orders",
          helpCenter: "Help Center",
          orderNotFound: "Order Not Found",
          orderNotFoundDescription: "We couldn't find an order with ID: {{orderId}}",
          viewAllOrders: "View All Orders",
          goToHelpCenter: "Go to Help Center",
          status: {
            confirmed: "Confirmed",
            preparing: "Preparing",
            outForDelivery: "Out for Delivery",
            delivered: "Delivered"
          },
          toast: {
            refundRequestPlaceholder: "Refund request would be processed here. Contact support for assistance.",
            liveChatPlaceholder: "Live chat would open here with order context"
          },
          actions: {
            trackOrder: "Track Order",
            contactSupport: "Contact Support",
            viewInvoice: "View Invoice",
            reportIssue: "Report Issue",
            viewOrderDetails: "View Order Details",
            requestRefund: "Request Refund",
            viewOrder: "View Order"
          },
          issues: {
            "late-delivery": {
              title: "Order is Late",
              description: "Your order hasn't arrived within the estimated time",
              solutions: {
                1: "Check the order tracking page for real-time updates",
                2: "Contact the delivery driver if contact information is available",
                3: "Wait an additional 15-20 minutes as delays can occur",
                4: "Contact support if the order is more than 30 minutes late"
              }
            },
            "missing-items": {
              title: "Missing Items",
              description: "Some items from your order are missing",
              solutions: {
                1: "Check your order receipt to verify what was ordered",
                2: "Check if items were delivered separately",
                3: "Contact support immediately with your order number",
                4: "Take photos if possible to help with the investigation"
              }
            },
            "wrong-order": {
              title: "Wrong Order Received",
              description: "You received items different from what you ordered",
              solutions: {
                1: "Keep the incorrect order - you won't be charged for it",
                2: "Contact support immediately with your order number",
                3: "We'll arrange a replacement or full refund",
                4: "You may be eligible for a discount on your next order"
              }
            },
            "quality-issue": {
              title: "Quality Issue",
              description: "Food quality doesn't meet expectations",
              solutions: {
                1: "Contact support within 24 hours of delivery",
                2: "Describe the issue in detail",
                3: "Take photos if possible",
                4: "We'll process a full refund or replacement"
              }
            },
            "payment-issue": {
              title: "Payment Problem",
              description: "Issues with payment or billing",
              solutions: {
                1: "Check your payment method in your profile",
                2: "Verify the charge on your bank statement",
                3: "Contact support if you were charged incorrectly",
                4: "We'll investigate and process a refund if needed"
              }
            },
            "cancel-order": {
              title: "Cancel Order",
              description: "Need to cancel your order",
              solutions: {
                1: "Orders can be cancelled within 5 minutes of placement",
                2: "After 5 minutes, contact support for cancellation",
                3: "If the order is already being prepared, cancellation may not be possible",
                4: "Refunds are processed automatically for cancelled orders"
              }
            }
          }
        },
        help: {
          title: "Help Center",
          subtitle: "Find answers to common questions or contact our support team",
          searchPlaceholder: "Search for help topics, questions, or keywords...",
          browseByCategory: "Browse by Category",
          noResultsFound: "No results found",
          tryDifferentKeywords: "Try searching with different keywords",
          clearSearch: "Clear Search",
          stillNeedHelp: "Still Need Help?",
          supportAvailable: "Our support team is here to assist you 24/7",
          phoneSupport: "Phone Support",
          phoneSupportDescription: "Call us anytime",
          emailSupport: "Email Support",
          emailSupportDescription: "We'll respond within 24 hours",
          liveChat: "Live Chat",
          liveChatDescription: "Available 24/7",
          liveChatPlaceholder: "Live chat would open here",
          startChat: "Start Chat",
          averageResponseTime: "Average response time: Less than 5 minutes",
          quickActions: {
            trackOrder: "Track Your Order",
            trackOrderDescription: "View order status",
            manageAccount: "Manage Account",
            manageAccountDescription: "Update profile & settings",
            contactSupport: "Contact Support",
            contactSupportDescription: "Get help from our team"
          },
          categories: {
            ordering: {
              title: "Ordering",
              description: "Learn how to place and manage orders",
              topics: {
                1: { question: "How do I place an order?", answer: "To place an order, browse restaurants, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order." },
                2: { question: "Can I modify or cancel my order?", answer: "You can modify or cancel your order within 5 minutes of placing it. After that, please contact support for assistance." },
                3: { question: "How do I track my order?", answer: "Go to 'My Orders' in your profile, select the order you want to track, and you'll see real-time updates on your order status." },
                4: { question: "What is the minimum order amount?", answer: "The minimum order amount varies by restaurant, typically ranging from $10 to $15. This information is displayed on each restaurant's page." }
              }
            },
            payments: {
              title: "Payments",
              description: "Payment methods and billing questions",
              topics: {
                1: { question: "What payment methods do you accept?", answer: "We accept all major credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and cash on delivery in select areas." },
                2: { question: "Is my payment information secure?", answer: "Yes, we use industry-standard encryption to protect your payment information. We never store your full card details." },
                3: { question: "Can I get a refund?", answer: "Refunds are processed for cancelled orders, incorrect items, or quality issues. Contact support within 24 hours of delivery for assistance." },
                4: { question: "Why was my payment declined?", answer: "Payment can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please verify your payment method and try again." }
              }
            },
            delivery: {
              title: "Delivery",
              description: "Delivery times, fees, and tracking",
              topics: {
                1: { question: "What are your delivery times?", answer: "Delivery times typically range from 30-60 minutes, depending on the restaurant and your location. Estimated time is shown before checkout." },
                2: { question: "How much is the delivery fee?", answer: "Delivery fees vary by restaurant and distance, typically ranging from $2.99 to $5.99. The exact fee is shown before you place your order." },
                3: { question: "What if my order is late?", answer: "If your order is significantly delayed, contact support. We'll investigate and may provide compensation or a refund." }
              }
            },
            account: {
              title: "Account & Profile",
              description: "Manage your account and preferences",
              topics: {
                1: { question: "How do I update my profile?", answer: "Go to 'Profile' in the menu, then select 'Edit Profile' to update your name, email, phone number, and other information." },
                2: { question: "How do I change my password?", answer: "Go to Profile > Settings > Security to change your password. You'll need to verify your current password first." },
                3: { question: "How do I manage my addresses?", answer: "Navigate to Profile > Addresses to view, add, edit, or delete delivery addresses. Set a default address for faster checkout." },
                4: { question: "How do I save my favorite restaurants?", answer: "Click the heart icon on any restaurant page to add it to your favorites. View all favorites in Profile > Favorites." }
              }
            },
            refunds: {
              title: "Refunds & Returns",
              description: "Refund policy and return process",
              topics: {
                1: { question: "What is your refund policy?", answer: "We offer full refunds for cancelled orders, incorrect items, or quality issues reported within 24 hours of delivery." },
                2: { question: "How long do refunds take?", answer: "Refunds are typically processed within 5-7 business days, depending on your payment method. You'll receive a confirmation email." },
                3: { question: "Can I return food items?", answer: "Due to food safety regulations, we cannot accept returns of food items. However, we'll provide a full refund for quality issues." },
                4: { question: "What if I received the wrong order?", answer: "Contact support immediately with your order number. We'll arrange a replacement or full refund, and you can keep the incorrect order." }
              }
            },
            general: {
              title: "General Questions",
              description: "Other frequently asked questions",
              topics: {
                1: { question: "Do you offer discounts or promotions?", answer: "Yes! Check the 'Offers' section for current promotions, discount codes, and special deals from restaurants." },
                2: { question: "How do I contact customer support?", answer: "You can contact us via phone, email, or live chat. Visit the 'Contact Support' section below for all contact options." },
                3: { question: "Is there a mobile app?", answer: "Yes, our mobile app is available for iOS and Android. Download it from the App Store or Google Play for the best experience." },
                4: { question: "Do you deliver to my area?", answer: "Enter your delivery address to see available restaurants in your area. We're constantly expanding our delivery zones." }
              }
            }
          }
        },
        profile: {
          defaultUserName: "यूज़र",
          notAvailable: "उपलब्ध नहीं",
          walletMoney: "{{companyName}} मनी",
          yourCoupons: "आपके कूपन",
          yourCart: "आपका कार्ट",
          yourProfile: "आपकी प्रोफाइल",
          profileCompletion: "{{percent}}% पूरा",
          vegMode: "वेज मोड",
          on: "चालू",
          off: "बंद",
          collections: "कलेक्शंस",
          yourCollections: "आपके कलेक्शंस",
          foodOrders: "फूड ऑर्डर्स",
          yourOrders: "आपके ऑर्डर्स",
          more: "और",
          about: "अबाउट",
          sendFeedback: "फीडबैक भेजें",
          reportSafetyEmergency: "सुरक्षा आपात स्थिति रिपोर्ट करें",
          settings: "सेटिंग्स",
          loggingOut: "लॉगआउट हो रहा है...",
          logOut: "लॉग आउट",
          vegModeDescription: "अपनी डाइट पसंद के अनुसार रेस्टोरेंट और डिश फ़िल्टर करें",
          vegModeOnTitle: "वेज मोड चालू",
          vegModeOnDescription: "केवल शाकाहारी विकल्प दिखाएं",
          vegModeOffTitle: "वेज मोड बंद",
          vegModeOffDescription: "सभी विकल्प दिखाएं",
          appearance: {
            title: "अपीयरेंस",
            description: "अपनी पसंदीदा थीम चुनें",
            value: {
              light: "लाइट",
              dark: "डार्क"
            },
            light: "लाइट",
            lightDescription: "डिफ़ॉल्ट लाइट थीम",
            dark: "डार्क",
            darkDescription: "डार्क थीम"
          }
        }
      },
      admin: {
        settings: {
          title: "सेटिंग्स",
          subtitle: "अपने अकाउंट की सेटिंग्स और प्रेफरेंसेस मैनेज करें",
          changePassword: "पासवर्ड बदलें",
          changePasswordDescription: "अकाउंट सुरक्षित रखने के लिए पासवर्ड अपडेट करें",
          currentPassword: "वर्तमान पासवर्ड",
          currentPasswordPlaceholder: "अपना वर्तमान पासवर्ड दर्ज करें",
          newPassword: "नया पासवर्ड",
          newPasswordPlaceholder: "अपना नया पासवर्ड दर्ज करें",
          confirmPassword: "नया पासवर्ड पुष्टि करें",
          confirmPasswordPlaceholder: "अपना नया पासवर्ड पुष्टि करें",
          passwordHint: "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए",
          changingPassword: "पासवर्ड बदला जा रहा है...",
          changePasswordAction: "पासवर्ड बदलें",
          accountSettings: "अकाउंट सेटिंग्स",
          accountSettingsDescription: "अतिरिक्त अकाउंट सेटिंग्स और प्रेफरेंसेस",
          moreSettingsSoon: "और सेटिंग्स विकल्प जल्द उपलब्ध होंगे।",
          validation: {
            currentRequired: "वर्तमान पासवर्ड आवश्यक है",
            newRequired: "नया पासवर्ड आवश्यक है",
            minLength: "पासवर्ड कम से कम 6 अक्षरों का होना चाहिए",
            confirmRequired: "कृपया नया पासवर्ड पुष्टि करें",
            mismatch: "पासवर्ड मेल नहीं खा रहे",
            mustDiffer: "नया पासवर्ड वर्तमान पासवर्ड से अलग होना चाहिए"
          },
          toast: {
            passwordUpdated: "पासवर्ड सफलतापूर्वक बदल दिया गया",
            passwordUpdateFailed: "पासवर्ड बदलने में विफल"
          }
        },
        coupons: {
          title: "कूपन और ऑफ़र",
          subtitle: "रेस्तरां ऑफ़र से अलग एडमिन कूपन मैनेज करें।",
          tabs: {
            adminCoupons: "एडमिन कूपन",
            restaurantOffers: "रेस्तरां ऑफ़र"
          },
          search: {
            adminPlaceholder: "कोड, टाइटल या डिस्क्रिप्शन से खोजें...",
            restaurantPlaceholder: "रेस्तरां, डिश या कूपन कोड से खोजें..."
          },
          form: {
            createTitle: "कस्टमर कूपन बनाएं",
            editTitle: "कस्टमर कूपन एडिट करें",
            fields: {
              couponCode: "कूपन कोड",
              title: "टाइटल",
              eligibility: "पात्रता",
              discountType: "डिस्काउंट प्रकार",
              discountPercent: "डिस्काउंट %",
              discountAmount: "डिस्काउंट राशि",
              maxDiscountAmount: "अधिकतम डिस्काउंट राशि",
              minOrderValue: "न्यूनतम ऑर्डर वैल्यू",
              validFrom: "मान्य प्रारंभ",
              validUntil: "मान्य समाप्ति",
              description: "विवरण"
            },
            placeholders: {
              couponCode: "FIRST20",
              title: "पहले ऑर्डर पर 20% छूट",
              discountPercent: "20",
              discountAmount: "100",
              optional: "वैकल्पिक",
              description: "कार्ट कूपन सेक्शन में यूज़र को दिखेगा"
            },
            cancelEdit: "एडिट रद्द करें",
            saving: "सेव हो रहा है...",
            saveChanges: "बदलाव सेव करें",
            createCta: "कूपन बनाएं"
          },
          eligibility: {
            firstDeliveredOnly: "सिर्फ पहला डिलीवर ऑर्डर",
            firstDelivered: "पहला डिलीवर ऑर्डर",
            allUsers: "सभी यूज़र"
          },
          discountType: {
            percentage: "प्रतिशत",
            flat: "फ्लैट राशि"
          },
          count: {
            coupon: "कूपन",
            coupons: "कूपन",
            offer: "ऑफ़र",
            offers: "ऑफ़र"
          },
          loading: {
            customerCoupons: "कस्टमर कूपन लोड हो रहे हैं...",
            restaurantOffers: "रेस्तरां ऑफ़र लोड हो रहे हैं..."
          },
          empty: {
            adminCoupons: "अभी कोई एडमिन कूपन नहीं बना है",
            restaurantOffers: "कोई रेस्तरां ऑफ़र नहीं मिला"
          },
          table: {
            code: "कोड",
            title: "टाइटल",
            eligibility: "पात्रता",
            discount: "डिस्काउंट",
            max: "अधिकतम",
            minOrder: "न्यूनतम ऑर्डर",
            deliveredUses: "डिलीवर उपयोग",
            status: "स्थिति",
            validUntil: "मान्य समाप्ति",
            actions: "एक्शन",
            noExpiry: "कोई समाप्ति नहीं"
          },
          restaurantTable: {
            title: "रेस्तरां ऑफ़र और कूपन",
            si: "क्र.",
            restaurant: "रेस्तरां",
            dish: "डिश",
            couponCode: "कूपन कोड",
            discount: "डिस्काउंट",
            price: "कीमत",
            status: "स्थिति",
            validUntil: "मान्य समाप्ति"
          },
          actions: {
            edit: "एडिट"
          },
          status: {
            draft: "ड्राफ्ट",
            active: "सक्रिय",
            paused: "रुका हुआ",
            expired: "समाप्त",
            cancelled: "रद्द",
            inactive: "निष्क्रिय"
          },
          currency: {
            rs: "₹"
          },
          common: {
            off: "छूट"
          },
          errors: {
            fetchData: "कूपन डेटा लाने में विफल",
            saveCoupon: "कस्टमर कूपन सेव करने में विफल",
            updateStatus: "कूपन स्टेटस अपडेट करने में विफल"
          }
        },
        category: {
          title: {
            page: "कैटेगरी",
            list: "कैटेगरी सूची"
          },
          search: {
            placeholder: "उदा : कैटेगरी"
          },
          common: {
            na: "N/A",
            thisCategory: "यह कैटेगरी"
          },
          table: {
            sl: "क्र.",
            image: "इमेज",
            name: "टाइटल",
            type: "प्रकार",
            status: "स्थिति",
            action: "एक्शन",
            id: "ID"
          },
          status: {
            active: "सक्रिय",
            inactive: "निष्क्रिय"
          },
          actions: {
            export: "एक्सपोर्ट",
            addNew: "नई कैटेगरी जोड़ें",
            clickToDeactivate: "निष्क्रिय करने के लिए क्लिक करें",
            clickToActivate: "सक्रिय करने के लिए क्लिक करें",
            edit: "एडिट",
            delete: "डिलीट",
            close: "बंद करें",
            showResults: "परिणाम दिखाएं",
            cancel: "रद्द करें",
            update: "अपडेट",
            create: "बनाएं"
          },
          loading: {
            categories: "कैटेगरी लोड हो रही हैं..."
          },
          empty: {
            noData: "कोई डेटा नहीं मिला",
            noMatch: "आपकी खोज से कोई कैटेगरी मेल नहीं खाती"
          },
          export: {
            generatedOn: "बनाया गया: {{date}}"
          },
          confirm: {
            delete: "क्या आप \"{{categoryName}}\" को हटाना चाहते हैं? यह कार्रवाई वापस नहीं होगी।"
          },
          success: {
            statusUpdated: "कैटेगरी स्टेटस सफलतापूर्वक अपडेट हुआ",
            deleted: "कैटेगरी सफलतापूर्वक हटाई गई",
            exported: "PDF सफलतापूर्वक एक्सपोर्ट हुई!",
            updated: "कैटेगरी सफलतापूर्वक अपडेट हुई",
            created: "कैटेगरी सफलतापूर्वक बनाई गई"
          },
          errors: {
            loginRequired: "कैटेगरी एक्सेस करने के लिए लॉगिन करें",
            loadFailed: "कैटेगरी लोड करने में विफल",
            authRequired: "ऑथेंटिकेशन आवश्यक है। कृपया दोबारा लॉगिन करें।",
            accessDenied: "एक्सेस अस्वीकृत। आपके पास अनुमति नहीं है।",
            endpointNotFound: "कैटेगरी एंडपॉइंट नहीं मिला। बैकएंड सर्वर जांचें।",
            serverError: "सर्वर त्रुटि। कृपया बाद में पुनः प्रयास करें।",
            loadWithStatus: "त्रुटि {{status}}: कैटेगरी लोड करने में विफल",
            network: "सर्वर से कनेक्ट नहीं हो सका। कृपया जांचें बैकएंड {{host}} पर चल रहा है।",
            updateStatusFailed: "कैटेगरी स्टेटस अपडेट करने में विफल",
            deleteFailed: "कैटेगरी हटाने में विफल",
            exportFailed: "PDF एक्सपोर्ट करने में विफल",
            invalidFileType: "अमान्य फ़ाइल प्रकार। कृपया PNG, JPG, JPEG, या WEBP अपलोड करें।",
            fileTooLarge: "फ़ाइल आकार 5MB सीमा से अधिक है।",
            saveFailed: "कैटेगरी सेव करने में विफल",
            saveWithStatus: "त्रुटि {{status}}: कैटेगरी सेव करने में विफल"
          },
          filters: {
            title: "फिल्टर",
            modalTitle: "फिल्टर और सॉर्टिंग",
            clearAll: "सभी साफ़ करें",
            sortBy: "इनके अनुसार सॉर्ट करें",
            deliveryTime: "डिलीवरी समय",
            restaurantRating: "रेस्तरां रेटिंग",
            distance: "दूरी",
            dishPrice: "डिश कीमत",
            cuisine: "क्यूज़ीन",
            trustMarkers: "ट्रस्ट मार्कर",
            tabs: {
              sortBy: "सॉर्ट",
              time: "समय",
              rating: "रेटिंग",
              distance: "दूरी",
              dishPrice: "कीमत",
              cuisine: "क्यूज़ीन",
              offers: "ऑफ़र",
              trust: "ट्रस्ट"
            },
            options: {
              relevance: "प्रासंगिकता",
              priceLowToHigh: "कीमत: कम से ज्यादा",
              priceHighToLow: "कीमत: ज्यादा से कम",
              ratingHighToLow: "रेटिंग: ज्यादा से कम",
              ratingLowToHigh: "रेटिंग: कम से ज्यादा",
              under30: "30 मिनट से कम",
              under45: "45 मिनट से कम",
              rated35: "रेटेड 3.5+",
              rated40: "रेटेड 4.0+",
              rated45: "रेटेड 4.5+",
              under1km: "1 किमी से कम",
              under2km: "2 किमी से कम",
              under1kmShort: "1किमी से कम",
              under2kmShort: "2किमी से कम",
              under200: "₹200 से कम",
              under500: "₹500 से कम",
              topRated: "टॉप रेटेड",
              trustedByUsers: "1000+ यूज़र द्वारा विश्वसनीय"
            }
          },
          modal: {
            editTitle: "कैटेगरी एडिट करें",
            createTitle: "नई कैटेगरी जोड़ें",
            fields: {
              categoryType: "कैटेगरी प्रकार *",
              selectCategoryType: "कैटेगरी प्रकार चुनें",
              categoryName: "कैटेगरी नाम *",
              categoryNamePlaceholder: "कैटेगरी नाम दर्ज करें",
              description: "विवरण",
              descriptionPlaceholder: "वैकल्पिक विवरण",
              categoryImage: "कैटेगरी इमेज",
              categoryPreviewAlt: "कैटेगरी प्रीव्यू",
              changeImage: "इमेज बदलें",
              uploadImage: "इमेज अपलोड करें",
              supportedFormats: "समर्थित फॉर्मेट: PNG, JPG, JPEG, WEBP (अधिकतम 5MB)",
              activeStatus: "सक्रिय स्थिति"
            },
            types: {
              starters: "स्टार्टर",
              mainCourse: "मुख्य कोर्स",
              desserts: "डेज़र्ट",
              beverages: "बेवरेज",
              varieties: "वैरायटी"
            }
          }
        }
      },
      delivery: {
        changeLanguage: {
          title: "भाषा बदलें",
          subtitle: "ऐप के लिए अपनी पसंदीदा भाषा चुनें",
          restartNotice: "भाषा लागू करने के लिए ऐप रीफ्रेश होगा।",
          saving: "भाषा सेव की जा रही है..."
        },
        settingsPage: {
          title: "सेटिंग्स",
          options: {
            notifications: {
              label: "पुश नोटिफिकेशन",
              description: "नए ऑर्डर्स के बारे में नोटिफिकेशन प्राप्त करें"
            },
            locationServices: {
              label: "लोकेशन सर्विसेज",
              description: "ऐप को आपकी लोकेशन एक्सेस करने दें"
            },
            biometricAuth: {
              label: "बायोमेट्रिक ऑथेंटिकेशन",
              description: "लॉगिन के लिए फिंगरप्रिंट या फेस आईडी का उपयोग करें"
            }
          },
          aria: {
            goBack: "वापस जाएं"
          }
        },
        notificationsPage: {
          title: "नोटिफिकेशन्स",
          newCount: "{{count}} नया",
          newCount_plural: "{{count}} नए",
          empty: "कोई नोटिफिकेशन नहीं",
          time: {
            minutesAgo: "{{count}} मिनट पहले",
            hoursAgo: "{{count}} घंटा पहले",
            hoursAgo_plural: "{{count}} घंटे पहले",
            daysAgo: "{{count}} दिन पहले",
            daysAgo_plural: "{{count}} दिन पहले"
          },
          items: {
            newOrderRequest: {
              title: "नया ऑर्डर अनुरोध",
              message: "आपको {{restaurant}} से नया ऑर्डर अनुरोध मिला है। ऑर्डर #{{orderId}}"
            },
            orderDelivered: {
              title: "ऑर्डर डिलीवर हुआ",
              message: "ऑर्डर #{{orderId}} सफलतापूर्वक डिलीवर हो गया। प्राप्त भुगतान: ₹ {{amount}}"
            },
            paymentPending: {
              title: "भुगतान लंबित",
              message: "ऑर्डर #{{orderId}} का भुगतान अभी लंबित है। कृपया ग्राहक से वसूल करें।"
            },
            systemUpdate: {
              title: "सिस्टम अपडेट",
              message: "डिलीवरी ऐप में नए फीचर्स जोड़े गए हैं। इन्हें देखें!"
            },
            orderCancelled: {
              title: "ऑर्डर रद्द",
              message: "ऑर्डर #{{orderId}} ग्राहक द्वारा रद्द कर दिया गया है।"
            },
            withdrawalSuccessful: {
              title: "निकासी सफल",
              message: "₹ {{amount}} की आपकी निकासी सफलतापूर्वक प्रोसेस हो गई है।"
            },
            profileUpdated: {
              title: "प्रोफाइल अपडेट हुआ",
              message: "आपकी प्रोफाइल जानकारी सफलतापूर्वक अपडेट हो गई है।"
            }
          },
          aria: {
            goBack: "वापस जाएं"
          }
        }
      },
      restaurant: {
        changeLanguage: {
          title: "भाषा बदलें",
          subtitle: "ऐप के लिए अपनी पसंदीदा भाषा चुनें",
          restartNotice: "भाषा लागू करने के लिए ऐप रीफ्रेश होगा।",
          saving: "भाषा सेव की जा रही है..."
        },
        editRestaurant: {
          title: "रेस्तरां संपादित करें",
          aria: {
            back: "वापस जाएं"
          },
          languages: {
            english: "अंग्रेज़ी",
            bengali: "बंगाली - বাংলা",
            arabic: "अरबी - العربية",
            spanish: "स्पेनिश"
          },
          fields: {
            restaurantName: "रेस्तरां नाम",
            restaurantNameWithLang: "रेस्तरां नाम ({{language}})",
            contact: "संपर्क",
            phoneNumber: "फोन नंबर",
            address: "पता",
            restaurantLogo: "रेस्तरां लोगो",
            restaurantCover: "रेस्तरां कवर",
            metaData: "मेटा डेटा",
            title: "शीर्षक",
            description: "विवरण",
            metaImage: "मेटा इमेज"
          },
          placeholders: {
            restaurantName: "रेस्तरां नाम दर्ज करें",
            phoneNumber: "01747410000",
            address: "पता दर्ज करें",
            metaTitle: "मेटा शीर्षक दर्ज करें",
            metaDescription: "मेटा विवरण दर्ज करें"
          },
          hints: {
            logo: "JPG, JPEG, PNG 1MB से कम (अनुपात 1:1)",
            cover: "JPG, JPEG, PNG 1MB से कम (अनुपात 2:1)"
          },
          actions: {
            uploadLogo: "लोगो अपलोड करें",
            uploadCover: "कवर अपलोड करें",
            uploadMetaImage: "मेटा इमेज अपलोड करें",
            update: "अपडेट"
          },
          alerts: {
            requiredFields: "कृपया सभी आवश्यक फ़ील्ड भरें (रेस्तरां नाम, पता, फोन नंबर)",
            saveFailed: "रेस्तरां डेटा सेव करने में त्रुटि हुई। कृपया पुनः प्रयास करें।"
          }
        },
        fssaiDetails: {
          aria: {
            back: "वापस"
          },
          restaurantName: "कड़ाही चम्मच रेस्टोरेंट",
          location: "बाय पास रोड (दक्षिण), इंदौर",
          warning: {
            title: "FSSAI 14 दिनों में समाप्त हो रहा है",
            subtitle: "ऑर्डर मिलते रहने के लिए समाप्ति से पहले अपडेट करें"
          },
          fields: {
            registrationNumber: "FSSAI पंजीकरण संख्या",
            document: "दस्तावेज़",
            validUpto: "मान्य तिथि"
          },
          actions: {
            updateLicense: "FSSAI लाइसेंस अपडेट करें",
            notRenewed: "क्या आपने FSSAI नवीनीकृत नहीं किया?",
            applyNow: "अभी आवेदन करें"
          }
        },
        dishRatings: {
          aria: {
            goBack: "वापस जाएं"
          },
          restaurantName: "कड़ाही चम्मच रेस्टोरेंट",
          restaurantLocation: "मुसाखेड़ी, इदरीश नगर, बाय पास रोड (दक्षिण), इंदौर",
          empty: "अभी तक आपके किसी डिश की रेटिंग नहीं आई है"
        },
        shareFeedback: {
          title: "अपना फीडबैक साझा करें",
          aria: {
            close: "बंद करें"
          },
          subtitlePrefix: "हमें बताएं आपका",
          subtitleMain: "{{companyName}} के साथ कुल अनुभव",
          scale: {
            veryBad: "बहुत खराब",
            veryGood: "बहुत अच्छा",
            ratedPrefix: "आपने अपने अनुभव को रेट किया",
            ratedSuffix: "।"
          },
          actions: {
            continue: "जारी रखें",
            done: "हो गया"
          },
          thanks: {
            title: "आपके फीडबैक के लिए धन्यवाद",
            subtitle: "यह {{companyName}} के साथ आपके अनुभव को बेहतर बनाने में मदद करता है।"
          },
          toast: {
            saveFailed: "फीडबैक सेव नहीं हो सका, लेकिन आपके इनपुट के लिए धन्यवाद!"
          }
        },
        fssaiUpdate: {
          title: "FSSAI अपडेट करें",
          aria: {
            back: "वापस"
          },
          fields: {
            registrationNumber: "FSSAI पंजीकरण संख्या",
            validUpto: "मान्य तिथि",
            uploadLicense: "अपना FSSAI लाइसेंस अपलोड करें"
          },
          placeholders: {
            registrationNumber: "उदा. 19138110019201",
            validUpto: "DD-MM-YYYY"
          },
          hints: {
            fileTypes: "jpeg, png, या pdf (अधिकतम 5MB)"
          },
          actions: {
            viewGuidelines: "अपलोड दिशानिर्देश देखें",
            confirm: "पुष्टि करें"
          }
        },
        editAddress: {
          aria: {
            goBack: "वापस जाएं"
          },
          title: "आउटलेट पता",
          map: {
            title: "आपका आउटलेट लोकेशन",
            subtitle: "ऑर्डर यहीं से पिकअप किए जाएंगे"
          },
          fields: {
            buildingStreet: "बिल्डिंग / स्ट्रीट",
            floorSuite: "फ्लोर / सूट (वैकल्पिक)",
            area: "एरिया",
            city: "शहर",
            landmark: "लैंडमार्क"
          },
          placeholders: {
            addressLine1: "बिल्डिंग नाम, स्ट्रीट आदि",
            addressLine2: "फ्लोर, सूट, सबयूनिट आदि",
            area: "एरिया / लोकैलिटी",
            city: "शहर",
            landmark: "पास की प्रसिद्ध जगह"
          },
          actions: {
            updating: "विवरण अपडेट हो रहा है...",
            save: "पता सेव करें"
          },
          toast: {
            updated: "पता सफलतापूर्वक अपडेट हुआ!",
            updateFailed: "पता अपडेट करने में विफल",
            updateProfileFailed: "प्रोफाइल अपडेट करने में विफल"
          }
        },
        phoneNumbers: {
          aria: {
            goBack: "वापस जाएं"
          },
          title: "महत्वपूर्ण संपर्क",
          sections: {
            orderReminder: {
              title: "ऑर्डर रिमाइंडर नंबर",
              subtitle: "लाइव ऑर्डर सपोर्ट और ऑर्डर रिमाइंडर के लिए यह नंबर हमेशा उपलब्ध होना चाहिए।",
              number1: "ऑर्डर रिमाइंडर नंबर #1",
              number2: "ऑर्डर रिमाइंडर नंबर #2"
            },
            restaurantPage: {
              title: "रेस्तरां पेज नंबर",
              subtitle: "Zomato ग्राहकों के लिए आपके रेस्तरां को कॉल करने का नंबर।"
            }
          },
          actions: {
            manageStaffContacts: "अपने स्टाफ के लिए संपर्क विवरण मैनेज करें",
            cancel: "रद्द करें",
            save: "सेव करें",
            verify: "सत्यापित करें"
          },
          editModal: {
            title: "फोन नंबर एडिट करें",
            countryCode: "कंट्री कोड",
            phoneNumber: "फोन नंबर",
            phonePlaceholder: "फोन नंबर दर्ज करें"
          },
          countryModal: {
            title: "कंट्री कोड चुनें"
          },
          otpModal: {
            title: "OTP सत्यापित करें",
            subtitle: "हमने 6-अंकों का OTP भेजा है",
            resend: "OTP फिर भेजें"
          }
        },
        withdrawalHistory: {
          aria: {
            goBack: "वापस जाएं"
          },
          title: "निकासी इतिहास",
          tabs: {
            pending: "लंबित निकासी",
            successful: "सफल निकासी"
          },
          loading: "लोड हो रहा है...",
          labels: {
            requested: "अनुरोधित",
            processed: "प्रोसेस्ड"
          },
          status: {
            pending: "लंबित",
            approved: "स्वीकृत",
            processed: "प्रोसेस्ड"
          },
          empty: {
            pending: "कोई लंबित निकासी अनुरोध नहीं",
            successful: "कोई सफल निकासी नहीं"
          },
          common: {
            na: "N/A"
          }
        },
        exploreMore: {
          title: "और विकल्प",
          common: {
            loading: "लोड हो रहा है...",
            na: "N/A"
          },
          sections: {
            manageOutlet: "आउटलेट प्रबंधन",
            settings: "सेटिंग्स",
            orders: "ऑर्डर",
            help: "मदद",
            accounting: "अकाउंटिंग"
          },
          items: {
            outletInfo: "आउटलेट जानकारी",
            outletTimings: "आउटलेट टाइमिंग",
            manageStaff: "स्टाफ प्रबंधन",
            zoneSetup: "ज़ोन सेटअप",
            deliverySetup: "डिलीवरी सेटअप",
            changeLanguage: "भाषा बदलें",
            orderHistory: "ऑर्डर हिस्ट्री",
            complaints: "शिकायतें",
            reviews: "रिव्यू",
            helpCentre: "हेल्प सेंटर",
            shareFeedback: "अपना फीडबैक साझा करें",
            payout: "पेआउट",
            invoices: "इनवॉइस",
            subscription: "सब्सक्रिप्शन"
          },
          search: {
            placeholder: "फीचर्स खोजें...",
            noResultsTitle: "कोई परिणाम नहीं मिला",
            noResultsSubtitle: "कृपया अलग कीवर्ड से खोजें",
            idleTitle: "फीचर्स खोजें",
            idleSubtitle: "आउटलेट सेटिंग्स, ऑर्डर और अन्य चीज़ें खोजने के लिए टाइप करें"
          },
          profile: {
            title: "मेरा प्रोफाइल",
            loggingOut: "लॉगआउट हो रहा है...",
            logout: "लॉगआउट",
            logoutAllDevices: "सभी डिवाइस से लॉगआउट",
            restaurantOwner: "रेस्तरां मालिक",
            roleOwner: "मालिक"
          },
          footer: {
            terms: "सेवा की शर्तें",
            privacy: "प्राइवेसी पॉलिसी",
            codeOfConduct: "आचार संहिता"
          },
          aria: {
            goBack: "वापस जाएं",
            search: "खोजें",
            profile: "प्रोफाइल",
            closeSearch: "खोज बंद करें",
            clearSearch: "खोज साफ़ करें",
            close: "बंद करें"
          }
        },
        inviteUser: {
          title: "यूज़र जोड़ें",
          aria: {
            goBack: "वापस जाएं",
            photoPreview: "स्टाफ फोटो प्रीव्यू",
            removePhoto: "फोटो हटाएं"
          },
          fields: {
            name: "नाम",
            phone: "फोन नंबर",
            email: "ईमेल पता",
            photoOptional: "फोटो (वैकल्पिक)"
          },
          placeholders: {
            name: "पूरा नाम दर्ज करें",
            phone: "फोन नंबर दर्ज करें",
            email: "ईमेल पता दर्ज करें"
          },
          sections: {
            selectRole: "यूज़र भूमिका चुनें"
          },
          roles: {
            staff: "स्टाफ",
            manager: "मैनेजर"
          },
          actions: {
            addByEmail: "इसके बजाय ईमेल से जोड़ें",
            addByPhone: "इसके बजाय फोन से जोड़ें",
            uploadPhoto: "फोटो अपलोड करें",
            addUser: "यूज़र जोड़ें",
            done: "हो गया"
          },
          validation: {
            phoneRequired: "फोन नंबर आवश्यक है",
            phoneMinLength: "फोन नंबर कम से कम 10 अंकों का होना चाहिए",
            phoneMaxLength: "फोन नंबर बहुत लंबा है",
            emailRequired: "ईमेल आवश्यक है",
            emailInvalid: "कृपया मान्य ईमेल पता दर्ज करें",
            nameRequired: "नाम आवश्यक है",
            nameMinLength: "नाम कम से कम 2 अक्षरों का होना चाहिए",
            invalidServerResponse: "सर्वर से अमान्य प्रतिक्रिया मिली",
            addFailed: "यूज़र जोड़ने में विफल। कृपया पुनः प्रयास करें।"
          },
          success: {
            managerTitle: "मैनेजर सफलतापूर्वक जोड़ दिया गया!",
            staffTitle: "स्टाफ सफलतापूर्वक जोड़ दिया गया!",
            description: "{{name}} को आपके आउटलेट में {{role}} के रूप में सफलतापूर्वक जोड़ दिया गया है।"
          }
        },
        downloadReport: {
          title: "रिपोर्ट डाउनलोड करें",
          aria: {
            back: "वापस"
          },
          banner: {
            generatingFor: "आप इसके लिए रिपोर्ट बना रहे हैं",
            allOutlets: "सभी आउटलेट"
          },
          labels: {
            selectReportView: "रिपोर्ट व्यू चुनें:",
            selectDataView: "डेटा के लिए व्यू चुनें:",
            selectDuration: "रिपोर्ट की अवधि चुनें:"
          },
          reportViews: {
            detailed: "विस्तृत रिपोर्ट",
            item: "आइटम सेल्स रिपोर्ट"
          },
          viewTypes: {
            daily: "दैनिक",
            weekly: "साप्ताहिक",
            monthly: "मासिक"
          },
          durations: {
            daily: {
              last7: "पिछले 7 दिन",
              last14: "पिछले 14 दिन",
              last30: "पिछले 30 दिन"
            },
            weekly: {
              last4w: "पिछले 4 सप्ताह",
              last8w: "पिछले 8 सप्ताह",
              last12w: "पिछले 12 सप्ताह"
            },
            monthly: {
              last3m: "पिछले 3 महीने",
              last6m: "पिछले 6 महीने",
              last12m: "पिछले 12 महीने"
            },
            common: {
              custom: "कस्टम"
            }
          },
          actions: {
            sendEmail: "ईमेल भेजें"
          },
          success: {
            title: "रिपोर्ट कतार में है",
            subtitle: "हम इसे जल्द ही आपको ईमेल करेंगे।"
          }
        },
        notificationRequest: {
          title: "ग्राहकों को सूचित करें",
          aria: {
            goBack: "वापस जाएं",
            imagePreview: "प्रीव्यू",
            removeImage: "इमेज हटाएं",
            deleteRequest: "अनुरोध हटाएं"
          },
          common: {
            optional: "वैकल्पिक",
            loading: "लोड हो रहा है..."
          },
          quota: {
            title: "आज की अनुरोध सीमा",
            subtitle: "मध्यरात्रि पर रीसेट होगा",
            used: "{{used}}/{{limit}} उपयोग"
          },
          submit: {
            title: "नोटिफिकेशन अनुरोध सबमिट करें",
            limitReached: "दैनिक अनुरोध सीमा पूरी हो गई। आप कल फिर सबमिट कर सकते हैं।",
            pendingExists: "आपका एक अनुरोध पहले से लंबित है। एडमिन समीक्षा का इंतजार करें।"
          },
          fields: {
            notificationTitle: "नोटिफिकेशन शीर्षक",
            description: "विवरण",
            image: "इमेज"
          },
          placeholders: {
            title: "उदा. आज सभी आइटम पर 30% छूट!",
            description: "ग्राहकों के लिए स्पष्ट और आकर्षक संदेश लिखें..."
          },
          upload: {
            helpText: "अपलोड करने के लिए क्लिक करें - JPG, PNG या WEBP, अधिकतम 5 MB",
            uploading: "अपलोड हो रहा है...",
            uploaded: "अपलोड हो गया"
          },
          actions: {
            submitRequest: "अनुरोध सबमिट करें",
            submitting: "सबमिट हो रहा है...",
            imageUploading: "इमेज अपलोड हो रही है..."
          },
          requests: {
            title: "मेरे अनुरोध",
            empty: "अभी तक कोई अनुरोध सबमिट नहीं किया गया।"
          },
          status: {
            pending: "समीक्षा लंबित",
            approved: "स्वीकृत और भेजा गया",
            rejected: "अस्वीकृत"
          },
          pagination: {
            pageOf: "पेज {{page}} / {{total}}",
            prev: "पिछला",
            next: "अगला"
          },
          validation: {
            imageType: "केवल JPG, PNG, या WEBP इमेज स्वीकार हैं।",
            imageSize: "इमेज 5 MB से कम होनी चाहिए।",
            noUploadUrl: "कोई URL प्राप्त नहीं हुआ",
            imageUploadFailed: "इमेज अपलोड विफल हुआ। आप बिना इमेज के भी सबमिट कर सकते हैं।",
            titleDescriptionRequired: "शीर्षक और विवरण आवश्यक हैं।",
            imageUploading: "इमेज अभी अपलोड हो रही है, कृपया प्रतीक्षा करें।"
          },
          feedback: {
            submitSuccess: "अनुरोध सफलतापूर्वक सबमिट हुआ! एडमिन जल्द समीक्षा करेगा।",
            submitFailed: "अनुरोध सबमिट करने में विफल। कृपया पुनः प्रयास करें।"
          }
        },
        contactDetails: {
          title: "संपर्क विवरण",
          sections: {
            owner: "मालिक",
            relationshipManager: "जापू रिलेशनशिप मैनेजर",
            manager: "मैनेजर",
            staff: "स्टाफ"
          },
          actions: {
            addSomeone: "किसी को जोड़ें",
            addUser: "यूज़र जोड़ें"
          },
          empty: {
            manager: "अभी तक किसी को मैनेजर के रूप में नहीं जोड़ा गया।",
            staff: "अभी तक किसी को स्टाफ के रूप में नहीं जोड़ा गया।"
          },
          confirm: {
            removeUser: "क्या आप वाकई इस यूज़र को हटाना चाहते हैं?"
          },
          errors: {
            deleteFailed: "यूज़र हटाने में विफल",
            removeFailed: "यूज़र हटाने में विफल। कृपया पुनः प्रयास करें।"
          },
          common: {
            loading: "लोड हो रहा है...",
            na: "N/A"
          },
          aria: {
            goBack: "वापस जाएं",
            ownerProfile: "मालिक प्रोफाइल",
            editOwner: "मालिक संपादित करें",
            rmProfile: "रिलेशनशिप मैनेजर प्रोफाइल",
            callRm: "रिलेशनशिप मैनेजर को कॉल करें",
            deleteUser: "यूज़र हटाएं"
          }
        },
        updateBank: {
          title: "बैंक विवरण अपडेट करें",
          aria: {
            back: "वापस"
          },
          sections: {
            accountInformation: "खाता जानकारी"
          },
          labels: {
            lastUpdatedOn: "अंतिम अपडेट: {{date}}",
            beneficiaryName: "लाभार्थी नाम",
            accountNumber: "खाता संख्या",
            ifscCode: "IFSC कोड",
            issueHelp: "क्या बैंक विवरण से संबंधित कोई समस्या है?"
          },
          fields: {
            enterBeneficiaryName: "लाभार्थी का नाम दर्ज करें",
            enterAccountNumber: "खाता संख्या दर्ज करें",
            confirmAccountNumber: "खाता संख्या की पुष्टि करें",
            enterIfsc: "IFSC दर्ज करें"
          },
          actions: {
            editBankDetails: "बैंक विवरण संपादित करें",
            submit: "सबमिट करें"
          },
          validation: {
            beneficiaryRequired: "लाभार्थी नाम आवश्यक है",
            beneficiaryMinLength: "लाभार्थी नाम कम से कम 3 अक्षरों का होना चाहिए",
            beneficiaryMaxLength: "लाभार्थी नाम 100 अक्षरों से कम होना चाहिए",
            beneficiaryPattern: "लाभार्थी नाम में केवल अक्षर, स्पेस और डॉट्स हो सकते हैं",
            accountRequired: "खाता संख्या आवश्यक है",
            accountDigitsOnly: "खाता संख्या में केवल अंक होने चाहिए",
            accountMinLength: "खाता संख्या कम से कम 9 अंकों की होनी चाहिए",
            accountMaxLength: "खाता संख्या 18 अंकों से कम होनी चाहिए",
            confirmRequired: "कृपया अपनी खाता संख्या की पुष्टि करें",
            accountMismatch: "खाता संख्याएं मेल नहीं खातीं",
            ifscRequired: "IFSC कोड आवश्यक है",
            ifscLength: "IFSC कोड ठीक 11 अक्षरों का होना चाहिए",
            ifscInvalid: "अमान्य IFSC कोड फॉर्मेट (उदा., SBIN0018764)"
          }
        },
        switchOutlet: {
          title: "आउटलेट बदलें",
          mappedOutlets: "आप {{count}} आउटलेट से जुड़े हैं",
          mappedOutlets_plural: "आप {{count}} आउटलेट्स से जुड़े हैं",
          sample: {
            name: "कड़ाही चम्मच रेस्टोरेंट",
            address: "बाय पास रोड (दक्षिण)"
          },
          labels: {
            outletId: "आउटलेट आईडी"
          },
          status: {
            offline: "ऑफलाइन",
            online: "ऑनलाइन"
          },
          helpText: "जिस आउटलेट की तलाश है वह नहीं मिला? लॉगआउट करें और किसी दूसरे अकाउंट से फिर कोशिश करें।",
          actions: {
            showOffline: "अभी ऑफलाइन आउटलेट दिखाएं",
            logout: "लॉगआउट",
            loggingOut: "लॉगआउट हो रहा है..."
          },
          aria: {
            goBack: "वापस जाएं",
            search: "खोजें"
          }
        },
        menuDiscountTiming: {
          pageTitles: {
            percentage: "प्रतिशत छूट",
            flatPrice: "फ्लैट प्राइस",
            default: "मेनू डिस्काउंट"
          },
          customerTarget: {
            title: "ग्राहक लक्ष्य",
            allCustomers: "सभी ग्राहक",
            newCustomers: "नए ग्राहक",
            newCustomersHint: "वे ग्राहक जिन्होंने पिछले 90 दिनों में ऑर्डर नहीं किया"
          },
          offerTimings: {
            title: "ऑफर समय"
          },
          days: {
            all: "सभी दिन",
            monThu: "सोम - गुरु",
            friSun: "शुक्र - रवि"
          },
          fields: {
            startDate: "शुरू होने की तारीख",
            targetMealtime: "लक्षित मीलटाइम"
          },
          mealtimes: {
            all: "सभी मीलटाइम",
            breakfast: "नाश्ता (8 AM - 11 AM)",
            lunch: "लंच (11 AM - 3 PM)",
            snacks: "स्नैक्स (3 PM - 7 PM)",
            dinner: "डिनर (7 PM - 11 PM)",
            lateNight: "लेट नाइट (11 PM - 6 AM)"
          },
          popup: {
            title: "लक्षित मीलटाइम चुनें"
          },
          actions: {
            previewOffer: "ऑफर प्रीव्यू",
            confirm: "पुष्टि करें"
          },
          toast: {
            created: "ऑफर सफलतापूर्वक बन गया!"
          }
        },
        notifications: {
          title: "नोटिफिकेशन",
          empty: "कोई नोटिफिकेशन नहीं",
          aria: {
            back: "वापस"
          }
        },
        status: {
          title: "रेस्तरां स्थिति",
          mappedRestaurants: "आप {{count}} रेस्तरां से जुड़े हैं",
          mappedRestaurants_plural: "आप {{count}} रेस्तरां से जुड़े हैं",
          common: {
            loading: "लोड हो रहा है...",
            restaurant: "रेस्तरां"
          },
          labels: {
            id: "आईडी",
            deliveryStatus: "डिलीवरी स्थिति",
            currentDeliverySlot: "वर्तमान डिलीवरी स्लॉट",
            todayOff: "आज बंद है",
            notConfigured: "कॉन्फ़िगर नहीं किया गया"
          },
          statusText: {
            receiving: "ऑर्डर प्राप्त हो रहे हैं",
            notReceiving: "ऑर्डर प्राप्त नहीं हो रहे"
          },
          actions: {
            details: "विवरण",
            cancel: "रद्द करें",
            goToOutletTimings: "आउटलेट टाइमिंग्स पर जाएं",
            changeOutletTimings: "आउटलेट टाइमिंग्स बदलें"
          },
          warnings: {
            outsideTimings: "आप वर्तमान में अपनी निर्धारित डिलीवरी टाइमिंग्स से बाहर हैं।"
          },
          dialogs: {
            outletClosed: {
              title: "आउटलेट टाइमिंग्स बंद हैं"
            },
            outsideTimings: {
              title: "डिलीवरी टाइमिंग्स के बाहर",
              description: "आप वर्तमान में अपनी निर्धारित डिलीवरी टाइमिंग्स से बाहर हैं। डिलीवरी स्थिति सक्षम करने के लिए आउटलेट टाइमिंग्स बदलें।"
            }
          },
          aria: {
            goBack: "वापस जाएं",
            exploreMore: "और विकल्प"
          }
        },
        outletTimings: {
          title: "आउटलेट टाइमिंग्स",
          days: {
            monday: "सोमवार",
            tuesday: "मंगलवार",
            wednesday: "बुधवार",
            thursday: "गुरुवार",
            friday: "शुक्रवार",
            saturday: "शनिवार",
            sunday: "रविवार"
          },
          status: {
            open: "खुला",
            close: "बंद"
          },
          fields: {
            openingTime: "खुलने का समय",
            closingTime: "बंद होने का समय"
          },
          placeholders: {
            openingTime: "खुलने का समय चुनें",
            closingTime: "बंद होने का समय चुनें"
          },
          labels: {
            current: "वर्तमान",
            dayClosed: "यह दिन बंद है"
          },
          aria: {
            goBack: "वापस जाएं"
          }
        },
        daySlots: {
          description: "यहां अपने रेस्तरां की टाइमिंग्स जोड़ें या बदलें। एक दिन में अधिकतम 3 टाइम स्लॉट बना सकते हैं।",
          days: {
            monday: "सोमवार",
            tuesday: "मंगलवार",
            wednesday: "बुधवार",
            thursday: "गुरुवार",
            friday: "शुक्रवार",
            saturday: "शनिवार",
            sunday: "रविवार"
          },
          labels: {
            slot: "स्लॉट-{{number}}",
            copyToAllDays: "उपरोक्त टाइमिंग्स सभी दिनों में कॉपी करें",
            total: "कुल"
          },
          fields: {
            startTime: "शुरू समय",
            endTime: "समाप्त समय"
          },
          placeholders: {
            startTime: "03:45",
            endTime: "02:15"
          },
          actions: {
            okay: "ठीक है",
            addTimeSlot: "+ टाइम स्लॉट जोड़ें",
            save: "सेव करें",
            cancel: "रद्द करें",
            delete: "हटाएं"
          },
          alerts: {
            maxSlots: "एक दिन में अधिकतम 3 स्लॉट की अनुमति है",
            minOneSlot: "कम से कम एक स्लॉट आवश्यक है",
            saveError: "स्लॉट सेव करने में त्रुटि हुई। कृपया पुनः प्रयास करें।"
          },
          dialog: {
            deleteTitle: "टाइम स्लॉट हटाएं",
            deleteDescription: "क्या आप वाकई इस टाइम स्लॉट को हटाना चाहते हैं? यह क्रिया वापस नहीं की जा सकती।"
          },
          aria: {
            goBack: "वापस जाएं",
            deleteSlot: "स्लॉट हटाएं",
            openTimePicker: "टाइम पिकर खोलें"
          }
        },
        editOwner: {
          title: "संपर्क विवरण",
          common: {
            loading: "लोड हो रहा है..."
          },
          fields: {
            name: "नाम",
            phone: "फोन नंबर",
            email: "ईमेल"
          },
          placeholders: {
            name: "नाम दर्ज करें",
            phone: "फोन नंबर दर्ज करें",
            email: "ईमेल पता दर्ज करें"
          },
          actions: {
            editPhoto: "फोटो संपादित करें",
            deleteAccount: "अपना Zomato अकाउंट हटाएं",
            deleting: "हटाया जा रहा है...",
            confirm: "पुष्टि करें",
            cancel: "रद्द करें",
            saving: "सेव हो रहा है...",
            save: "सेव करें"
          },
          deleteDialog: {
            title: "आप अपना Zomato अकाउंट हटाने वाले हैं",
            description: "आपके अकाउंट से जुड़ी सभी जानकारी हट जाएगी और आप अपने रेस्तरां का एक्सेस हमेशा के लिए खो देंगे। अकाउंट हटने के बाद यह जानकारी वापस नहीं मिलेगी। क्या आप जारी रखना चाहते हैं?"
          },
          alerts: {
            uploadImageFailed: "प्रोफाइल इमेज अपलोड नहीं हो सकी। कृपया पुनः प्रयास करें।",
            invalidServerResponse: "सर्वर से अमान्य प्रतिक्रिया मिली",
            saveFailed: "मालिक विवरण सेव करने में विफल: {{message}}",
            deleteFailed: "अकाउंट हटाने में विफल: {{message}}",
            tryAgain: "कृपया पुनः प्रयास करें।"
          },
          aria: {
            goBack: "वापस जाएं",
            ownerProfile: "मालिक प्रोफाइल"
          }
        },
        challenges: {
          title: "बिज़नेस चैलेंज",
          errors: {
            fetchFailed: "चैलेंज लाने में विफल",
            unexpected: "चैलेंज लाते समय कुछ गलत हुआ"
          },
          frequency: {
            daily: "दैनिक",
            weekly: "साप्ताहिक",
            monthly: "मासिक"
          },
          hero: {
            badge: "ग्रोथ बूस्टर",
            title: "अपनी क्षमता बढ़ाएं",
            description: "सक्रिय चैलेंज पूरे करें, विज़िबिलिटी बढ़ाएं, अतिरिक्त कमीशन कमाएं और अपने ब्रांड को आगे बढ़ाएं। लक्ष्य पूरा होते ही रिवॉर्ड अपने आप लागू हो जाते हैं।",
            totalRewards: "कुल रिवॉर्ड",
            rank: "रैंक"
          },
          filters: {
            all: "सभी चैलेंज",
            active: "सक्रिय",
            completed: "पूर्ण"
          },
          labels: {
            target: "लक्ष्य",
            rewardFreeBanner: "रिवॉर्ड: फ्री बैनर (1 दिन)",
            rewardAmount: "रिवॉर्ड: ₹{{amount}}",
            progress: "प्रगति",
            expires: "समाप्ति",
            freeBanner: "फ्री बैनर (1 दिन)",
            amountWithCurrency: "₹{{amount}}"
          },
          actions: {
            viewDetails: "विवरण देखें",
            gotIt: "समझ गया"
          },
          empty: {
            title: "कोई चैलेंज नहीं मिला",
            description: "अभी {{filter}} चैलेंज उपलब्ध नहीं हैं। आने वाले ग्रोथ बूस्टर्स पर नज़र रखें!"
          },
          details: {
            frequency: "आवृत्ति",
            target: "लक्ष्य",
            reward: "रिवॉर्ड",
            validity: "वैधता",
            currentProgress: "वर्तमान प्रगति",
            status: "स्थिति"
          },
          common: {
            dash: "—"
          }
        },
        allOrders: {
          common: {
            restaurant: "रेस्तरां",
            customer: "ग्राहक",
            item: "आइटम",
            addressNotAvailable: "पता उपलब्ध नहीं है"
          },
          reasons: {
            rejectedByRestaurantWithReason: "रेस्तरां द्वारा अस्वीकार: {{reason}}",
            cancelledByWithReason: "{{actor}} द्वारा रद्द: {{reason}}",
            rejectedByRestaurant: "रेस्तरां द्वारा अस्वीकार",
            cancelledByCustomer: "ग्राहक द्वारा रद्द"
          },
          labels: {
            showingOrderHistoryFor: "ऑर्डर हिस्ट्री दिखाई जा रही है",
            id: "आईडी",
            orderedBy: "ऑर्डर किया",
            moreItems: "और आइटम"
          },
          status: {
            pending: "लंबित",
            preparing: "तैयार हो रहा",
            ready: "तैयार",
            outForDelivery: "डिलीवरी के लिए निकला",
            delivered: "डिलीवर",
            rejected: "अस्वीकृत",
            cancelled: "रद्द"
          },
          tags: {
            cutlery: "कटलरी",
            expressDelivery: "एक्सप्रेस डिलीवरी",
            selfDelivery: "सेल्फ डिलीवरी",
            vegOnly: "सिर्फ वेज",
            foodRescue: "फूड रेस्क्यू",
            irctc: "IRCTC",
            replacement: "रिप्लेसमेंट",
            hospital: "हॉस्पिटल",
            largeOrder: "बड़ा ऑर्डर"
          },
          search: {
            placeholder: "ऑर्डर आईडी से खोजें",
            filterPlaceholder: "खोजें"
          },
          filter: {
            title: "फ़िल्टर",
            applied: "{{count}} फ़िल्टर लागू",
            applied_plural: "{{count}} फ़िल्टर्स लागू",
            categories: {
              orderStatus: "ऑर्डर स्थिति",
              ratings: "रेटिंग्स",
              kptDelay: "KPT देरी",
              complaints: "शिकायतें",
              orderType: "ऑर्डर प्रकार"
            },
            options: {
              preparing: "तैयार हो रहा",
              ready: "तैयार",
              outForDelivery: "डिलीवरी के लिए निकला",
              delivered: "डिलीवर",
              rejected: "अस्वीकृत",
              cancelled: "रद्द",
              fiveOrLess: "5★ या कम",
              fourOrLess: "4★ या कम",
              threeOrLess: "3★ या कम",
              twoOrLess: "2★ या कम",
              oneStar: "1★",
              zeroToTen: "0-10 मिनट",
              tenToTwenty: "10-20 मिनट",
              twentyToThirty: "20-30 मिनट",
              thirtyPlus: "30+ मिनट",
              orderDelayed: "ऑर्डर में देरी",
              wrongItems: "गलत आइटम डिलीवर",
              missingItems: "आइटम गायब/डिलीवर नहीं",
              poorTaste: "खराब स्वाद या गुणवत्ता",
              poorPackaging: "खराब पैकेजिंग या लीकेज",
              outOfStock: "आइटम स्टॉक में नहीं",
              notDelivered: "ऑर्डर डिलीवर नहीं हुआ",
              selfDelivery: "सेल्फ डिलीवरी",
              foodRescue: "फूड रेस्क्यू",
              largeOrder: "बड़ा ऑर्डर",
              vegOnly: "सिर्फ वेज",
              irctc: "IRCTC",
              replacement: "रिप्लेसमेंट",
              hospital: "हॉस्पिटल"
            }
          },
          dateRange: {
            select: "तारीख सीमा चुनें",
            options: {
              last2Days: "पिछले 2 दिन",
              thisWeek: "यह सप्ताह",
              lastWeek: "पिछला सप्ताह",
              last30Days: "पिछले 30 दिन",
              customDateRange: "कस्टम तारीख सीमा"
            }
          },
          loading: {
            orders: "ऑर्डर लोड हो रहे हैं..."
          },
          errors: {
            fetchOrdersFailed: "ऑर्डर लाने में विफल",
            loadingOrders: "ऑर्डर लोड करने में त्रुटि"
          },
          empty: {
            title: "कोई ऑर्डर नहीं मिला",
            subtitle: "अपने फ़िल्टर्स बदलकर देखें"
          },
          actions: {
            clearAll: "सभी साफ़ करें",
            clearFilters: "फ़िल्टर्स साफ़ करें",
            apply: "लागू करें",
            applying: "लागू हो रहा है...",
            applyingFilters: "फ़िल्टर्स लागू हो रहे हैं..."
          },
          toast: {
            orderIdCopied: "ऑर्डर आईडी क्लिपबोर्ड में कॉपी हो गई"
          },
          aria: {
            goBack: "वापस जाएं",
            help: "मदद",
            filter: "फ़िल्टर",
            copyOrderId: "ऑर्डर आईडी कॉपी करें",
            close: "बंद करें"
          }
        },
        helpCentre: {
          title: "हेल्प सेंटर",
          howCanWeHelp: "हम आपकी कैसे मदद कर सकते हैं",
          searchPlaceholder: "समस्या से खोजें",
          empty: "\"{{query}}\" से मेल खाते कोई हेल्प टॉपिक्स नहीं मिले",
          topics: {
            outletStatus: {
              title: "आउटलेट ऑनलाइन / ऑफलाइन स्थिति",
              subtitle: "वर्तमान स्थिति और विवरण"
            },
            orderIssues: {
              title: "ऑर्डर से जुड़ी समस्याएं",
              subtitle: "कैंसलेशन और डिलीवरी से जुड़ी चिंताएं"
            },
            restaurant: {
              title: "रेस्तरां",
              subtitle: "टाइमिंग, संपर्क, FSSAI, बैंक विवरण, लोकेशन आदि"
            },
            menu: {
              title: "मेन्यू",
              subtitle: "आइटम, फोटो, कीमत, शुल्क आदि"
            },
            payments: {
              title: "पेमेंट्स",
              subtitle: "अकाउंट स्टेटमेंट, इनवॉइस आदि"
            }
          },
          aria: {
            goBack: "वापस जाएं"
          }
        },
        hyperpure: {
          title: "Hyperpure",
          underDevelopment: "यह पेज निर्माणाधीन है"
        },
        chooseDiscountType: {
          title: "डिस्काउंट प्रकार चुनें",
          choosePromo: "अपना प्रोमो डिस्काउंट प्रकार चुनें",
          goals: {
            "grow-customers": "अपना ग्राहक आधार बढ़ाएं",
            "increase-value": "अपने ऑर्डर का मूल्य बढ़ाएं",
            "mealtime-orders": "मीaltime ऑर्डर बढ़ाएं"
          },
          types: {
            percentage: {
              title: "प्रतिशत डिस्काउंट",
              description: "'30% OFF up to ₹75' जैसे प्रोमो डिस्काउंट बनाएं",
              offLabel: "OFF"
            }
          },
          aria: {
            goBack: "वापस जाएं"
          }
        },
        chooseMenuDiscountType: {
          title: "अपने ग्राहकों को खुश करें",
          chooseMenuDiscount: "अपना मेन्यू डिस्काउंट प्रकार चुनें",
          types: {
            freebies: {
              title: "फ्रीबीज़",
              description: "अपने हाई-वैल्यू ग्राहकों को खुश करने के लिए एक कॉम्प्लिमेंट्री डिश दें"
            },
            percentage: {
              title: "प्रतिशत डिस्काउंट",
              description: "चुने हुए आइटम्स पर फ्लैट प्रतिशत डिस्काउंट"
            },
            flatPrice: {
              title: "फ्लैट प्राइस",
              description: "₹99, ₹129, ₹129 जैसी फिक्स कीमतों पर आइटम चुनें"
            },
            bogo: {
              title: "BOGO",
              description: "चुने हुए आइटम्स पर Buy 1 Get 1 free ऑफर"
            }
          },
          aria: {
            goBack: "वापस जाएं"
          }
        },
        hubGrowth: {
          title: "अपना बिज़नेस बढ़ाएं",
          buildYourOwn: "खुद बनाएं",
          cards: {
            offers: {
              title: "ऑफ़र और डिस्काउंट",
              subtitle: "अपने ऑफ़र शुरू करें और बिज़नेस बढ़ाएं"
            },
            promotedBanners: {
              title: "प्रमोटेड बैनर्स",
              subtitle: "होमपेज और सर्च पर बेहतर विज़िबिलिटी पाएं"
            },
            notifyCustomers: {
              title: "ग्राहकों को नोटिफाई करें",
              subtitle: "सभी यूज़र्स को पुश नोटिफिकेशन भेजने के लिए एडमिन को रिक्वेस्ट करें"
            },
            businessChallenges: {
              title: "बिज़नेस चैलेंज",
              subtitle: "माइलस्टोन पूरे करें, रिवॉर्ड पाएं और तेज़ी से बढ़ें"
            }
          },
          aria: {
            openMenu: "मेन्यू खोलें"
          }
        },
        newOrderNotification: {
          title: "नया ऑर्डर!",
          orderNumber: "ऑर्डर #{{id}}",
          totalAmount: "कुल राशि",
          items: "आइटम्स:",
          moreItems: "और आइटम्स",
          deliveryCharge: "डिलीवरी चार्ज",
          distanceKm: "{{km}} किमी",
          yourDeliveryEarnings: "डिलीवरी से आपकी कमाई",
          deliveryAddress: "डिलीवरी पता",
          address: "पता",
          estimatedDelivery: "अनुमानित डिलीवरी: {{mins}} मिनट",
          note: "नोट:",
          payment: {
            cashOnDelivery: "कैश ऑन डिलीवरी",
            onlinePayment: "ऑनलाइन पेमेंट"
          },
          actions: {
            dismiss: "बंद करें",
            viewOrder: "ऑर्डर देखें"
          },
          aria: {
            close: "बंद करें"
          }
        },
        subscriptionFeatureOverlay: {
          title: "प्रीमियम फीचर",
          message: "इस ग्रोथ टूल को अनलॉक करने के लिए अपना प्लान अपग्रेड करें।",
          actions: {
            viewPlans: "सब्सक्रिप्शन प्लान देखें",
            goBack: "वापस जाएं"
          }
        },
        featureLockedScreen: {
          premiumAccess: "प्रीमियम एक्सेस",
          lockedTitle: "{{feature}} लॉक है",
          description: "आपके वर्तमान प्लान में यह फीचर शामिल नहीं है। इसे तुरंत अनलॉक करने और बिना रुकावट जारी रखने के लिए अपग्रेड करें।",
          upgradeBenefitsTitle: "अपग्रेड के बाद आपको क्या मिलेगा",
          benefits: {
            fullAccess: "• प्रतिबंधित टूल्स का पूरा एक्सेस",
            betterVisibility: "• बेहतर ग्रोथ और एनालिटिक्स विज़िबिलिटी",
            continuousAccess: "• बिना रुकावट निरंतर फीचर एक्सेस"
          },
          features: {
            thisFeature: "यह फीचर",
            order_management: "ऑर्डर मैनेजमेंट",
            menu_control: "मेन्यू मैनेजमेंट",
            basic_reports: "रिपोर्ट्स",
            marketing_tools: "मार्केटिंग टूल्स",
            advanced_analytics: "एडवांस्ड एनालिटिक्स",
            advanced_marketing_tools: "एडवांस्ड मार्केटिंग टूल्स",
            relationship_manager: "रिलेशनशिप मैनेजर"
          },
          actions: {
            viewPlans: "सब्सक्रिप्शन प्लान देखें",
            goBack: "वापस जाएं"
          }
        },
        subscriptionExpiryBanner: {
          currentPlan: "वर्तमान प्लान",
          titles: {
            trialExpired: "आपका ट्रायल समाप्त हो गया है",
            trialEndingSoon: "आपका फ्री ट्रायल जल्द समाप्त होने वाला है",
            planExpired: "आपका प्लान समाप्त हो गया है",
            planEndingSoon: "आपका प्लान जल्द समाप्त होने वाला है"
          },
          subtitles: {
            expired: "बिना रुकावट एक्सेस जारी रखने के लिए सब्सक्रिप्शन प्लान खरीदें।",
            expiresToday: "आज समाप्त हो रहा है ({{planName}})। जारी रखने के लिए प्लान खरीदें।",
            expiresTomorrow: "कल समाप्त हो रहा है ({{planName}})। जारी रखने के लिए प्लान खरीदें।",
            expiresInDays: "{{daysLeft}} दिनों में समाप्त होगा ({{planName}})। जारी रखने के लिए प्लान खरीदें।"
          },
          actions: {
            buyPlan: "प्लान खरीदें"
          }
        }
      }
    }
  },
  bn: {
    translation: {
      common: {
        language: "ভাষা",
        languageNames: {
          en: "ইংরেজি",
          hi: "হিন্দি",
          bn: "বাংলা"
        },
        cancel: "বাতিল",
        save: "সেভ করুন",
        saving: "সেভ হচ্ছে...",
        savingLanguage: "ভাষা সেভ করা হচ্ছে...",
        languageRefreshNotice: "ভাষা প্রয়োগ করতে অ্যাপটি রিফ্রেশ হবে।",
        languageSettingsDescription: "অ্যাপ জুড়ে ব্যবহৃত ভাষা নির্বাচন করুন।",
        languageUpdated: "{{language}} আপডেট হয়েছে",
        languageUpdateFailed: "ভাষার পছন্দ আপডেট করা যায়নি"
      },
      user: {
        settings: {
          title: "সেটিংস",
          notificationsPreferences: "নোটিফিকেশন ও পছন্দসমূহ",
          emailNotifications: "ইমেইল নোটিফিকেশন",
          emailNotificationsDescription: "আপনার অর্ডারের আপডেট ইমেইলে পান",
          pushNotifications: "পুশ নোটিফিকেশন",
          pushNotificationsDescription: "আপনার ডিভাইসে পুশ নোটিফিকেশন পান"
        },
        carousel: {
          previous: "পূর্বের",
          next: "পরের"
        },
        bottomNavigation: {
          delivery: "ডেলিভারি",
          under250: "আন্ডার ২৫০",
          profile: "প্রোফাইল"
        },
        locationDisplay: {
          selectLocation: "লোকেশন নির্বাচন করুন",
          gettingLocation: "লোকেশন আনা হচ্ছে...",
          locationUnavailable: "লোকেশন পাওয়া যাচ্ছে না",
          locationUnavailableWithError: "লোকেশন পাওয়া যাচ্ছে না: {{error}}",
          deliveringTo: "ডেলিভারি হচ্ছে",
          select: "নির্বাচন করুন",
          loading: "লোড হচ্ছে...",
          currentLocation: "বর্তমান লোকেশন"
        },
        locationExample: {
          basicHookUsage: "বেসিক হুক ব্যবহার",
          loadingLocation: "লোকেশন লোড হচ্ছে...",
          area: "এলাকা",
          city: "শহর",
          state: "রাজ্য",
          coordinates: "কোঅর্ডিনেটস",
          notAvailable: "উপলব্ধ নয়",
          getLocation: "লোকেশন নিন",
          selectLocation: "লোকেশন নির্বাচন করুন",
          deliveringTo: "ডেলিভারি হচ্ছে",
          loading: "লোড হচ্ছে...",
          usingLocationDisplayComponent: "LocationDisplay কম্পোনেন্ট ব্যবহার",
          fullDisplay: "ফুল ডিসপ্লে",
          compactDisplayNavbar: "কমপ্যাক্ট ডিসপ্লে (নেভবার)",
          fullLocationDisplay: "পূর্ণ লোকেশন ডিসপ্লে",
          allowLocation: "লোকেশন অনুমতি দিন",
          cart: "কার্ট",
          profile: "প্রোফাইল"
        },
        userHome: {
          title: "ইউজার মডিউল",
          subtitle: "ইউজার সেকশনে স্বাগতম"
        },
        auth: {
          signIn: {
            bannerAlt: "ফুড ব্যানার",
            title: "ভারতের #1 ফুড ডেলিভারি অ্যাপ",
            subtitle: "লগ ইন করুন বা সাইন আপ করুন",
            selectCountryCode: "দেশ কোড নির্বাচন করুন",
            placeholders: {
              fullName: "আপনার পূর্ণ নাম লিখুন",
              phoneNumber: "ফোন নম্বর লিখুন",
              email: "আপনার ইমেইল ঠিকানা লিখুন"
            },
            usePhoneInstead: "এর বদলে ফোন ব্যবহার করুন",
            rememberMe: "দ্রুত সাইন-ইনের জন্য আমার লগইন মনে রাখুন",
            creatingAccount: "অ্যাকাউন্ট তৈরি হচ্ছে...",
            signingIn: "সাইন ইন হচ্ছে...",
            continue: "চালিয়ে যান",
            or: "অথবা",
            signInWithGoogle: "Google দিয়ে সাইন ইন করুন",
            signInWithEmail: "ইমেইল দিয়ে সাইন ইন করুন",
            disclaimer: "চালিয়ে গেলে, আপনি আমাদের এই নীতিগুলিতে সম্মতি দিচ্ছেন",
            termsOfService: "সেবার শর্তাবলী",
            privacyPolicy: "গোপনীয়তা নীতি",
            contentPolicy: "কনটেন্ট নীতি",
            validation: {
              emailRequired: "ইমেইল প্রয়োজন",
              emailInvalid: "অনুগ্রহ করে সঠিক ইমেইল ঠিকানা লিখুন",
              phoneRequired: "ফোন নম্বর প্রয়োজন",
              phone10Digits: "ফোন নম্বর 10 সংখ্যার হতে হবে",
              phoneRange: "ফোন নম্বর 7-15 সংখ্যার মধ্যে হতে হবে",
              nameRequired: "নাম প্রয়োজন",
              nameMin: "নাম কমপক্ষে 2 অক্ষরের হতে হবে",
              nameMax: "নাম 50 অক্ষরের কম হতে হবে",
              namePattern: "নামে শুধু অক্ষর, স্পেস, হাইফেন এবং অ্যাপোস্ট্রফি থাকতে পারে"
            },
            errors: {
              invalidServerResponse: "সার্ভার থেকে অবৈধ রেসপন্স এসেছে। আবার চেষ্টা করুন।",
              failedToCompleteSignIn: "সাইন-ইন সম্পূর্ণ করা যায়নি। আবার চেষ্টা করুন।",
              googleSignInFailed: "Google সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
              serverError: "সার্ভার ত্রুটি। পরে আবার চেষ্টা করুন।",
              authenticationFailed: "অথেন্টিকেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",
              networkError: "নেটওয়ার্ক ত্রুটি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
              invalidCredentials: "অবৈধ ক্রেডেনশিয়াল। আবার চেষ্টা করুন।",
              failedToSendOtp: "OTP পাঠানো যায়নি। আবার চেষ্টা করুন।",
              firebaseNotInitialized: "Firebase Auth ইনিশিয়ালাইজ হয়নি। আপনার Firebase কনফিগারেশন পরীক্ষা করুন।",
              firebaseConfiguration: "Firebase কনফিগারেশন ত্রুটি। Firebase Console-এ আপনার ডোমেইন অনুমোদিত আছে কি না নিশ্চিত করুন। বর্তমান ডোমেইন: {{domain}}",
              popupBlocked: "পপআপ ব্লক করা হয়েছে। পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।",
              signInCancelled: "সাইন-ইন বাতিল করা হয়েছে। আবার চেষ্টা করুন।"
            }
          },
          otp: {
            title: "OTP যাচাইকরণ",
            oneLastThing: "আরেকটি ছোট বিষয়",
            namePrompt: "প্রোফাইল সম্পূর্ণ করতে আপনার নামটি জানান",
            enterOtpSentTo: "অনুগ্রহ করে আপনার {{target}}-এ পাঠানো OTP দিন",
            email: "ইমেইল",
            mobileNumber: "মোবাইল নম্বর",
            sentTo: "পাঠানো হয়েছে",
            didntReceiveCode: "কোড পাননি?",
            remaining: "বাকি",
            resendOtp: "OTP পুনরায় পাঠান",
            yourFullName: "আপনার পূর্ণ নাম",
            namePlaceholder: "যেমন: Rahul Sharma",
            completeRegistration: "রেজিস্ট্রেশন সম্পূর্ণ করুন",
            submit: "সাবমিট",
            changeMobileNumber: "মোবাইল নম্বর পরিবর্তন করুন",
            validation: {
              nameRequired: "নাম প্রয়োজন",
              nameMin: "নাম কমপক্ষে 2 অক্ষরের হতে হবে"
            },
            errors: {
              invalidServerResponse: "সার্ভার থেকে অবৈধ রেসপন্স এসেছে",
              failedToVerify: "OTP যাচাই করা যায়নি। আবার চেষ্টা করুন।",
              verificationStepMissing: "OTP যাচাইকরণ ধাপ পাওয়া যায়নি। নতুন OTP অনুরোধ করুন।",
              failedToCompleteRegistration: "রেজিস্ট্রেশন সম্পূর্ণ করা যায়নি। আবার চেষ্টা করুন।",
              failedToResend: "OTP পুনরায় পাঠানো যায়নি। আবার চেষ্টা করুন।"
            }
          }
        },
        notificationPopup: {
          specialOffer: "স্পেশাল অফার",
          close: "বন্ধ করুন"
        },
        collectionsPage: {
          yourCollections: "আপনার কালেকশনস",
          defaultBookmarks: "বুকমার্কস",
          delivery: "ডেলিভারি",
          dishCount_one: "{{count}} ডিশ",
          dishCount_other: "{{count}} ডিশ",
          restaurantCount_one: "{{count}} রেস্টুরেন্ট",
          restaurantCount_other: "{{count}} রেস্টুরেন্ট",
          itemCounts: "{{dishes}} {{dishesLabel}} • {{restaurants}} {{restaurantsLabel}}",
          createNew: "নতুন তৈরি করুন",
          collection: "কালেকশন",
          createNewCollection: "নতুন কালেকশন তৈরি করুন",
          uniqueNamePrompt: "আপনার কালেকশনের জন্য একটি আলাদা নাম দিন",
          collectionNamePlaceholder: "যেমন, উইকএন্ড ফেভারিটস",
          preview: "প্রিভিউ",
          createCollection: "কালেকশন তৈরি করুন"
        },
        categoryPage: {
          all: "সব",
          searchPlaceholder: "রেস্টুরেন্টের নাম বা কোনো ডিশ...",
          loadingCategories: "ক্যাটাগরি লোড হচ্ছে...",
          noCategoriesAvailable: "কোনো ক্যাটাগরি উপলভ্য নয়",
          filters: "ফিল্টার",
          allRestaurants: "সব রেস্টুরেন্ট",
          loadingRestaurants: "রেস্টুরেন্ট লোড হচ্ছে...",
          notAvailable: "উপলব্ধ নয়",
          noRestaurantsForQuery: "\"{{query}}\"-এর জন্য কোনো রেস্টুরেন্ট পাওয়া যায়নি",
          noRestaurantsWithFilters: "নির্বাচিত ফিল্টারে কোনো রেস্টুরেন্ট পাওয়া যায়নি",
          clearAllFilters: "সব ফিল্টার পরিষ্কার করুন",
          filtersAndSorting: "ফিল্টার ও সর্টিং",
          clearAll: "সব পরিষ্কার করুন",
          sortBy: "সর্ট করুন",
          deliveryTime: "ডেলিভারি সময়",
          restaurantRating: "রেস্টুরেন্ট রেটিং",
          rated35Plus: "রেটেড 3.5+",
          under200: "₹200 এর নিচে",
          under500: "₹500 এর নিচে",
          priceMatch: "প্রাইস ম্যাচ",
          trustMarkers: "ট্রাস্ট মার্কার",
          topRated: "টপ রেটেড",
          trustedByUsers: "1000+ ইউজারের ভরসা",
          close: "বন্ধ করুন",
          showResults: "রেজাল্ট দেখান",
          filterPills: {
            under30mins: "30 মিনিটের নিচে",
            under45mins: "45 মিনিটের নিচে",
            rating4Plus: "রেটিং 4.0+",
            rating45Plus: "রেটিং 4.5+",
            under1km: "1 কিমি এর নিচে",
            under2km: "2 কিমি এর নিচে",
            flat50off: "ফ্ল্যাট 50% OFF",
            under250: "₹250 এর নিচে"
          },
          tabs: {
            sortBy: "সর্ট বাই",
            time: "সময়",
            rating: "রেটিং",
            distance: "দূরত্ব",
            dishPrice: "ডিশের দাম",
            cuisine: "কুইজিন",
            offers: "অফার",
            trust: "ভরসা"
          },
          sortOptions: {
            relevance: "প্রাসঙ্গিকতা",
            priceLowToHigh: "দাম: কম থেকে বেশি",
            priceHighToLow: "দাম: বেশি থেকে কম",
            ratingHighToLow: "রেটিং: বেশি থেকে কম",
            ratingLowToHigh: "রেটিং: কম থেকে বেশি"
          },
          cuisines: {
            chinese: "চাইনিজ",
            american: "আমেরিকান",
            japanese: "জাপানিজ",
            italian: "ইতালিয়ান",
            mexican: "মেক্সিকান",
            indian: "ইন্ডিয়ান",
            asian: "এশিয়ান",
            seafood: "সিফুড",
            desserts: "ডেজার্টস",
            cafe: "ক্যাফে",
            healthy: "হেলদি"
          }
        },
        searchResults: {
          matchingDishesAndRestaurants: "ম্যাচিং ডিশ ও রেস্টুরেন্ট",
          dishWithRestaurant: "ডিশ · {{restaurant}}",
          restaurantFallback: "রেস্টুরেন্ট",
          closed: "বন্ধ",
          noMatchesFound: "কোনো মিল পাওয়া যায়নি।"
        },
        under250: {
          title: "আন্ডার 250",
          bannerTitle: "মডার্ন ও ট্রেন্ডি",
          bannerAlt: "আন্ডার 250 ব্যানার",
          sort: "সোর্ট",
          apply: "প্রয়োগ করুন",
          add: "যোগ করুন",
          viewFullMenu: "সম্পূর্ণ মেনু দেখুন",
          bestPrice: "সেরা দাম",
          noRestaurantsUnder250: "₹250-এর নিচে ডিশসহ কোনো রেস্টুরেন্ট পাওয়া যায়নি।",
          noRestaurantsWithFilters: "নির্বাচিত ফিল্টারের সাথে কোনো রেস্টুরেন্ট মেলেনি।",
          itemDescriptionFallback: "{{restaurant}} থেকে {{item}}",
          sortOptions: {
            deliveryTimeLowToHigh: "ডেলিভারি সময়: কম থেকে বেশি",
            distanceLowToHigh: "দূরত্ব: কাছ থেকে দূরে"
          }
        },
        home: {
          exploreMoreHeading: "আরও দেখুন",
          searchPlaceholderBurger: "\"বার্গার\" খুঁজুন",
          searchPlaceholderBiryani: "\"বিরিয়ানি\" খুঁজুন",
          searchPlaceholderPizza: "\"পিজা\" খুঁজুন",
          searchPlaceholderDesserts: "\"ডেজার্ট\" খুঁজুন",
          searchPlaceholderChinese: "\"চাইনিজ\" খুঁজুন",
          searchPlaceholderThali: "\"থালি\" খুঁজুন",
          searchPlaceholderMomos: "\"মোমো\" খুঁজুন",
          searchPlaceholderDosa: "\"দোসা\" খুঁজুন",
          voiceNotSupported: "এই ব্রাউজারে স্পিচ রিকগনিশন সাপোর্টেড নয়।",
          listening: "শোনা হচ্ছে...",
          searchingFor: "\"{{text}}\" খোঁজা হচ্ছে",
          microphoneDenied: "মাইক্রোফোন অ্যাক্সেস বন্ধ আছে। ব্রাউজার সেটিংসে চালু করুন।",
          couldNotHear: "আপনার কথা শোনা যায়নি। আবার চেষ্টা করুন।",
          vegMode: "মোড",
          orderNow: "এখন অর্ডার করুন",
          seeAll: "সব দেখুন",
          noCategories: "কোনো ক্যাটাগরি উপলভ্য নয়",
          filters: "ফিল্টার",
          handpickedForYou: "আপনার জন্য বাছাই করা",
          topRestaurants: "টপ রেস্টুরেন্ট",
          loadingRestaurants: "রেস্টুরেন্ট লোড হচ্ছে...",
          loading: "লোড হচ্ছে...",
          showResults: "রেজাল্ট দেখুন",
          select: "নির্বাচন করুন",
          location: "লোকেশন",
          goToImage: "ইমেজ {{index}} এ যান",
          inTheSpotlight: "স্পটলাইটে",
          restaurantsDeliveringToYou: "{{count}} রেস্টুরেন্ট আপনার কাছে ডেলিভারি করছে",
          featured: "ফিচারড",
          removeFromFavorites: "ফেভারিট থেকে সরান",
          addToFavorites: "ফেভারিটে যোগ করুন",
          byRatings: "{{value}} দ্বারা",
          allCategories: "সব ক্যাটাগরি",
          close: "বন্ধ করুন",
          addedToBookmark: "বুকমার্কে যোগ হয়েছে",
          exploreItems: {
            offers: "অফার",
            gourmet: "গুরমে",
            topRestaurants: "টপ রেস্টুরেন্ট",
            collections: "কলেকশনস"
          },
          filterTabs: {
            sortBy: "সোর্ট বাই",
            time: "সময়",
            rating: "রেটিং",
            distance: "দূরত্ব",
            dishPrice: "ডিশ প্রাইস",
            cuisine: "কুইজিন",
            offers: "অফার",
            trust: "ট্রাস্ট"
          },
          sortOptions: {
            relevance: "প্রাসঙ্গিকতা",
            priceLowToHigh: "দাম: কম থেকে বেশি",
            priceHighToLow: "দাম: বেশি থেকে কম",
            ratingHighToLow: "রেটিং: বেশি থেকে কম",
            ratingLowToHigh: "রেটিং: কম থেকে বেশি"
          },
          quickFilters: {
            under30Mins: "৩০ মিনিটের নিচে",
            under45Mins: "৪৫ মিনিটের নিচে",
            under1Km: "১ কিমির নিচে",
            under2Km: "২ কিমির নিচে"
          },
          cuisineOptions: {
            chinese: "চাইনিজ",
            american: "আমেরিকান",
            japanese: "জাপানিজ",
            italian: "ইতালিয়ান",
            mexican: "মেক্সিকান",
            indian: "ইন্ডিয়ান",
            asian: "এশিয়ান",
            seafood: "সিফুড",
            desserts: "ডেজার্টস",
            cafe: "ক্যাফে",
            healthy: "হেলদি"
          },
          fallbacks: {
            deliveryTime2530: "২৫-৩০ মিনিট",
            deliveryTime2025: "২০-২৫ মিনিট",
            distance1_2km: "১.২ কিমি",
            multiCuisine: "মাল্টি-কুইজিন",
            specialSuffix: "স্পেশাল",
            specialDish: "স্পেশাল ডিশ"
          },
          filterModal: {
            title: "ফিল্টার ও সোর্টিং",
            clearAll: "সব পরিষ্কার করুন",
            close: "বন্ধ করুন",
            sections: {
              sortBy: "সোর্ট বাই",
              deliveryTime: "ডেলিভারি সময়",
              restaurantRating: "রেস্টুরেন্ট রেটিং",
              distance: "দূরত্ব",
              dishPrice: "ডিশ প্রাইস",
              cuisine: "কুইজিন",
              trustMarkers: "ট্রাস্ট মার্কারস",
              offers: "অফার"
            },
            options: {
              under30Mins: "৩০ মিনিটের নিচে",
              under45Mins: "৪৫ মিনিটের নিচে",
              rated35Plus: "রেটেড ৩.৫+",
              rated40Plus: "রেটেড ৪.০+",
              rated45Plus: "রেটেড ৪.৫+",
              under1Km: "১ কিমির নিচে",
              under2Km: "২ কিমির নিচে",
              under200: "₹২০০-এর নিচে",
              under500: "₹৫০০-এর নিচে",
              topRated: "টপ রেটেড",
              trustedByUsers: "১০০০+ ব্যবহারকারীর ভরসা",
              restaurantsWithOffers: "অফারসহ রেস্টুরেন্ট"
            }
          },
          vegPopup: {
            title: "যেখান থেকে ভেজ ডিশ দেখবেন",
            allRestaurants: "সব রেস্টুরেন্ট",
            pureVegOnly: "শুধু পিওর ভেজ রেস্টুরেন্ট",
            apply: "প্রয়োগ করুন",
            moreSettings: "আরও সেটিংস"
          },
          switchOffPopup: {
            title: "Veg Mode বন্ধ করবেন?",
            description: "আপনি সব রেস্টুরেন্ট দেখবেন, নন-ভেজ ডিশ পরিবেশনকারীদেরও",
            switchOff: "বন্ধ করুন",
            keepUsing: "এই মোডেই থাকুন"
          },
          vegLoading: {
            exploreVeg: "সব রেস্টুরেন্ট থেকে ভেজ ডিশ দেখুন"
          },
          switchingOff: {
            title: "বন্ধ করা হচ্ছে",
            subtitle: "আপনার জন্য Veg Mode"
          },
          manageCollections: {
            title: "কলেকশন ম্যানেজ করুন",
            bookmarks: "বুকমার্কস",
            bookmarksCount_one: "{{count}} রেস্টুরেন্ট",
            bookmarksCount_other: "{{count}} রেস্টুরেন্ট",
            createNew: "নতুন কলেকশন তৈরি করুন",
            done: "Done"
          },
          gstDialog: {
            title: "GST বিবরণ",
            description: "খাবার, ডেলিভারি ও প্ল্যাটফর্ম চার্জে সরকারের নেওয়া ট্যাক্স।",
            foodPriceGst: "ফুড প্রাইস GST (5%)",
            onAmountAfterDiscount: "ডিসকাউন্টের পরে {{amount}}-এর উপর",
            deliveryFeeGst: "ডেলিভারি ফি GST (18%)",
            platformFeeGst: "প্ল্যাটফর্ম ফি GST (18%)",
            onAmount: "{{amount}}-এর উপর",
            totalGst: "মোট GST"
          },
          restaurantDetails: {
            loadingRestaurant: "রেস্টুরেন্ট লোড হচ্ছে...",
            connectionError: "কানেকশন এরর",
            restaurantNotFound: "রেস্টুরেন্ট পাওয়া যায়নি",
            error: "ত্রুটি",
            backendRunningAt: "নিশ্চিত করুন ব্যাকএন্ড সার্ভার {{url}} এ চলছে",
            goBack: "ফিরে যান",
            search: "সার্চ",
            searchForDishes: "ডিশ খুঁজুন...",
            unknownRestaurant: "অজানা রেস্টুরেন্ট",
            outOfDeliveryRangeBadge: "ডেলিভারি রেঞ্জের বাইরে — অর্ডার করতে ঠিকানা বদলান",
            byReviews: "{{count}}+ দ্বারা",
            fallbackDistance: "1.2 কিমি",
            fallbackLocation: "লোকেশন",
            fallbackDeliveryTime: "25-30 মিনিট",
            fallbackRestaurantInitial: "R",
            filters: "ফিল্টার",
            veg: "ভেজ",
            nonVeg: "নন-ভেজ",
            unnamedSection: "নামহীন সেকশন",
            recommendedForYou: "আপনার জন্য সাজেস্টেড",
            noDishRecommended: "কোনো ডিশ সাজেস্টেড নয়",
            subsection: "সাবসেকশন",
            mustTry: "অবশ্যই ট্রাই করুন",
            requested: "রিকোয়েস্টেড",
            highlyReordered: "খুব বেশি রি-অর্ডার করা",
            noImage: "কোনো ছবি নেই",
            add: "ADD",
            outOfDeliveryRange: "ডেলিভারি রেঞ্জের বাইরে",
            menu: "মেনু",
            largeOrderMenu: "লার্জ অর্ডার মেনু",
            largeOrderComingSoon: "লার্জ অর্ডার অপশন শীঘ্রই আসছে",
            close: "বন্ধ করুন",
            filtersAndSorting: "ফিল্টার ও সোর্টিং",
            sortBy: "সোর্ট বাই:",
            priceLowToHigh: "দাম - কম থেকে বেশি",
            priceHighToLow: "দাম - বেশি থেকে কম",
            vegNonVegPreference: "ভেজ/নন-ভেজ পছন্দ:",
            topPicks: "টপ পিকস:",
            dietaryPreference: "ডায়েটারি পছন্দ:",
            spicy: "স্পাইসি",
            clearAll: "সব মুছুন",
            apply: "প্রয়োগ করুন",
            allDeliveryOutletsFor: "এর জন্য সব ডেলিভারি আউটলেট",
            nearestAvailableOutlet: "সবচেয়ে কাছের উপলভ্য আউটলেট",
            noOutletsAvailable: "কোনো আউটলেট উপলভ্য নয়",
            seeAllOutlets: "সব {{count}} আউটলেট দেখুন",
            manageCollections: "কলেকশন ম্যানেজ করুন",
            bookmarks: "বুকমার্কস",
            bookmarksSummary: "{{dishes}} ডিশ • {{restaurants}} রেস্টুরেন্ট",
            createNewCollection: "নতুন কলেকশন তৈরি করুন",
            done: "Done",
            noImageAvailable: "কোনো ছবি উপলভ্য নয়",
            notEligibleForCoupons: "কুপনের জন্য প্রযোজ্য নয়",
            addItem: "আইটেম যোগ করুন",
            offersAt: "{{restaurant}} এ অফার",
            goldExclusiveOffer: "গোল্ড এক্সক্লুসিভ অফার",
            freeDeliveryAbove99: "₹99-এর উপরে ফ্রি ডেলিভারি",
            joinGoldToUnlock: "আনলক করতে Gold যোগ দিন",
            addGold: "Gold যোগ করুন - ₹1",
            restaurantCoupons: "রেস্টুরেন্ট কুপন",
            useCode: "কোড ব্যবহার করুন {{code}}",
            termsApply: "শর্তাবলী প্রযোজ্য",
            removeFromCollection: "কলেকশন থেকে সরান",
            addToCollection: "কলেকশনে যোগ করুন",
            shareThisRestaurant: "এই রেস্টুরেন্ট শেয়ার করুন",
            disclaimer: "মেনু আইটেম, দাম, ছবি ও বিবরণ সরাসরি রেস্টুরেন্ট সেট করে। ভুল তথ্য দেখলে অনুগ্রহ করে আমাদের রিপোর্ট করুন।",
            multiCuisine: "মাল্টি-কুইজিন",
            specialDish: "স্পেশাল ডিশ",
            thisRestaurant: "এই রেস্টুরেন্ট",
            shareRestaurantText: "{{company}} এ {{restaurant}} দেখে নিন! {{url}}",
            shareDishText: "{{restaurant}} থেকে {{dish}} দেখে নিন! {{url}}",
            toast: {
              loginToAddItems: "কার্টে আইটেম যোগ করতে লগইন করুন",
              outsideServiceZone: "আপনি সার্ভিস জোনের বাইরে আছেন। সার্ভিস এরিয়ার মধ্যে লোকেশন নির্বাচন করুন।",
              restaurantOutOfRange: "এই রেস্টুরেন্ট আপনার বর্তমান ঠিকানায় ডেলিভারি করে না। অর্ডার করতে লোকেশন বদলান।",
              itemInfoMissing: "আইটেম তথ্য পাওয়া যায়নি। পেজ রিফ্রেশ করুন।",
              restaurantInfoMissingRefresh: "রেস্টুরেন্ট তথ্য পাওয়া যায়নি। পেজ রিফ্রেশ করুন।",
              restaurantIdMissing: "রেস্টুরেন্ট ID পাওয়া যায়নি। পেজ রিফ্রেশ করুন।",
              cannotAddDifferentRestaurant: "অন্য রেস্টুরেন্টের আইটেম যোগ করা যাবে না। আগে কার্ট ক্লিয়ার করুন।",
              restaurantInfoMissing: "রেস্টুরেন্ট তথ্য পাওয়া যায়নি",
              dishInfoMissing: "ডিশ তথ্য পাওয়া যায়নি",
              dishRemoved: "ডিশ ফেভারিট থেকে সরানো হয়েছে",
              dishAdded: "ডিশ ফেভারিটে যোগ হয়েছে",
              restaurantDataUnavailable: "রেস্টুরেন্ট ডেটা উপলভ্য নয়",
              restaurantRemovedFromCollection: "রেস্টুরেন্ট কলেকশন থেকে সরানো হয়েছে",
              restaurantAddedToCollection: "রেস্টুরেন্ট কলেকশনে যোগ হয়েছে",
              restaurantShared: "রেস্টুরেন্ট সফলভাবে শেয়ার হয়েছে",
              dishShared: "ডিশ সফলভাবে শেয়ার হয়েছে",
              linkCopied: "লিংক ক্লিপবোর্ডে কপি হয়েছে!",
              copyFailed: "লিংক কপি করা যায়নি"
            }
          }
        },
        accessibility: {
          title: "অ্যাক্সেসিবিলিটি",
          hero: {
            title: "অ্যাপকে আরও অ্যাক্সেসিবল করুন",
            description: "আপনার প্রয়োজন ও পছন্দ অনুযায়ী অভিজ্ঞতাকে কাস্টমাইজ করুন।"
          },
          options: {
            largeText: {
              label: "বড় টেক্সট",
              description: "সহজে পড়ার জন্য টেক্সট বড় করুন"
            },
            highContrast: {
              label: "হাই কনট্রাস্ট",
              description: "ভাল দৃশ্যমানতার জন্য কনট্রাস্ট বাড়ান"
            },
            screenReaderSupport: {
              label: "স্ক্রিন রিডার সাপোর্ট",
              description: "স্ক্রিন রিডারের জন্য অপ্টিমাইজ করুন"
            },
            reduceMotion: {
              label: "মোশন কমান",
              description: "অ্যানিমেশন ও ট্রানজিশন কমান"
            }
          },
          needMoreHelp: {
            title: "আরও সাহায্য দরকার?",
            description: "অতিরিক্ত অ্যাক্সেসিবিলিটি ফিচার দরকার হলে বা আপনার পরামর্শ থাকলে, আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।",
            contactSupport: "সাপোর্টে যোগাযোগ করুন"
          }
        },
        coupons: {
          title: "আপনার কুপন",
          empty: {
            title: "কোনো কুপন পাওয়া যায়নি",
            description: "অর্ডার দেওয়ার পর ম্যাপ স্ক্রিনে লুকানো কুপন খুঁজে নিন"
          }
        },
        trackingPage: {
          restaurantName: "সাগর রেস্টুরেন্ট",
          orderPlaced: "অর্ডার করা হয়েছে",
          foodPreparationSoon: "খাবার প্রস্তুতি খুব শিগগিরই শুরু হবে",
          arrivingIn: "পৌঁছাবে",
          arrivalMins: "{{mins}} মিনিটে",
          distanceAway: "{{km}} কিমি দূরে",
          foodCooking: "খাবার রান্না হচ্ছে",
          deliveryPartnerSafety: "ডেলিভারি পার্টনারের সুরক্ষা সম্পর্কে জানুন",
          deliveryDetailsBanner: "আপনার সব ডেলিভারি ডিটেইলস এক জায়গায় 👋",
          contactName: "অজয় পাঞ্চাল",
          edit: "এডিট",
          deliveryAtLocation: "লোকেশনে ডেলিভারি",
          deliveryAddressSample: "X2RJ+QHR, দেবাস, মধ্য প্রদেশ 45..."
        },
        navbar: {
          loading: "লোড হচ্ছে...",
          select: "নির্বাচন করুন",
          location: "লোকেশন",
          wallet: "ওয়ালেট",
          cart: "কার্ট",
          pointsTitle: "{{points}} পয়েন্ট",
          menu: {
            cart: "আপনার কার্ট",
            profile: "প্রোফাইল",
            myOrders: "আমার অর্ডার",
            offers: "অফার",
            help: "সাহায্য",
            signOut: "সাইন আউট"
          }
        },
        stickyCart: {
          restaurant: "রেস্টুরেন্ট",
          viewMenu: "মেনু দেখুন",
          viewCart: "কার্ট দেখুন",
          itemsCount_one: "{{count}} আইটেম",
          itemsCount_other: "{{count}} আইটেম"
        },
        notifications: {
          title: "নোটিফিকেশন",
          promotionsAndOffers: "প্রমোশন ও অফার",
          ordersAndUpdates: "অর্ডার ও আপডেট",
          emptyTitle: "কোনো নোটিফিকেশন নেই",
          emptyDescription: "আপনি সম্পূর্ণ আপডেটেড!",
          time: {
            justNow: "এখনই",
            minutesAgo: "{{count}}মি আগে",
            hoursAgo: "{{count}}ঘণ্টা আগে"
          },
          sample: {
            orderConfirmedTitle: "অর্ডার নিশ্চিত",
            orderConfirmedMessage: "আপনার অর্ডার #12345 নিশ্চিত হয়েছে এবং প্রস্তুত করা হচ্ছে",
            twoMinutesAgo: "2 মিনিট আগে",
            specialOfferTitle: "বিশেষ অফার",
            specialOfferMessage: "INR 500 এর বেশি পরের অর্ডারে 50% ছাড় পান",
            oneHourAgo: "1 ঘণ্টা আগে",
            newRestaurantTitle: "নতুন রেস্টুরেন্ট যুক্ত হয়েছে",
            newRestaurantMessage: "আপনার এলাকায় নতুন ইতালিয়ান রেস্টুরেন্ট দেখে নিন",
            threeHoursAgo: "3 ঘণ্টা আগে",
            orderDeliveredTitle: "অর্ডার ডেলিভার হয়েছে",
            orderDeliveredMessage: "আপনার অর্ডার #12340 সফলভাবে ডেলিভার হয়েছে",
            yesterday: "গতকাল",
            paymentFailedTitle: "পেমেন্ট ব্যর্থ",
            paymentFailedMessage: "অর্ডার #12338 এর পেমেন্ট ব্যর্থ হয়েছে। আবার চেষ্টা করুন",
            twoDaysAgo: "2 দিন আগে",
            weekendSpecialTitle: "উইকেন্ড স্পেশাল",
            weekendSpecialMessage: "এই উইকেন্ডে সব অর্ডারে ফ্রি ডেলিভারি উপভোগ করুন",
            threeDaysAgo: "3 দিন আগে"
          }
        },
        offers: {
          bannerAlt: "দারুণ অফার",
          loading: "অফার লোড হচ্ছে...",
          retry: "আবার চেষ্টা করুন",
          empty: "এই মুহূর্তে কোনো অফার নেই",
          errorFallback: "অফার লোড করা যায়নি"
        },
        top10: {
          bannerAlt: "টপ রেস্টুরেন্ট",
          title: "টপ রেস্টুরেন্ট",
          subtitle: "আপনার এলাকার সবচেয়ে প্রিয় রেস্টুরেন্টগুলো",
          loading: "টপ রেস্টুরেন্ট লোড হচ্ছে...",
          retry: "আবার চেষ্টা করুন",
          empty: "এই মুহূর্তে কোনো টপ রেস্টুরেন্ট নেই",
          errorFallback: "টপ রেস্টুরেন্ট লোড করা যায়নি"
        },
        gourmet: {
          bannerAlt: "গুরমে ফুড",
          title: "প্রিমিয়াম গুরমে রেস্টুরেন্ট",
          subtitle: "চমৎকার খাবার আপনার দরজায়",
          count: "{{count}} গুরমে রেস্টুরেন্ট",
          loading: "গুরমে রেস্টুরেন্ট লোড হচ্ছে...",
          retry: "আবার চেষ্টা করুন",
          empty: "এই মুহূর্তে কোনো গুরমে রেস্টুরেন্ট নেই",
          errorFallback: "গুরমে রেস্টুরেন্ট লোড করা যায়নি"
        },
        orders: {
          title: "আপনার অর্ডার",
          searchPlaceholder: "রেস্টুরেন্ট বা ডিশ দিয়ে খুঁজুন",
          viewMenu: "মেনু দেখুন",
          viewDetails: "বিস্তারিত দেখুন",
          reorder: "আবার অর্ডার করুন",
          youRated: "আপনি রেট করেছেন",
          rateOrder: "অর্ডার রেট করুন",
          orderPlacedOn: "অর্ডার করা হয়েছে",
          deliveredOn: "ডেলিভার হয়েছে",
          payment: "পেমেন্ট:",
          locationNotAvailable: "লোকেশন পাওয়া যায়নি",
          deliveryLabel: "ডেলিভারি",
          noItemsFound: "কোনো আইটেম পাওয়া যায়নি",
          itemFallback: "আইটেম",
          each: "প্রতি",
          optional: "ঐচ্ছিক",
          refundInfo: "২৪-৪৮ ঘণ্টার মধ্যে রিফান্ড প্রসেস হবে",
          countdownRemaining_one: "{{count}} মিনিট বাকি",
          countdownRemaining_other: "{{count}} মিনিট বাকি",
          paymentMethod: {
            cashOnDelivery: "ক্যাশ অন ডেলিভারি",
            wallet: "ওয়ালেট",
            online: "অনলাইন",
            na: "N/A"
          },
          share: {
            text: "{{companyName}}-এ {{restaurant}} দেখুন।\nলোকেশন: {{location}}\n{{companyName}} অ্যাপে এই রেস্টুরেন্ট থেকে আবার অর্ডার করুন।"
          },
          menu: {
            shareRestaurant: "রেস্টুরেন্ট শেয়ার করুন",
            orderDetails: "অর্ডারের বিস্তারিত"
          },
          empty: {
            noOrders: "আপনি এখনো কোনো অর্ডার দেননি",
            startOrdering: "অর্ডার শুরু করুন",
            noSearchResults: "আপনার সার্চ অনুযায়ী কোনো অর্ডার পাওয়া যায়নি"
          },
          error: {
            failedToLoad: "অর্ডার লোড করা যায়নি",
            loginRequired: "অর্ডার দেখতে লগইন করুন"
          },
          toast: {
            restaurantInfoMissing: "রেস্টুরেন্ট তথ্য পাওয়া যায়নি",
            restaurantCopied: "রেস্টুরেন্টের তথ্য কপি হয়েছে",
            sharingNotSupported: "এই ডিভাইসে শেয়ারিং সাপোর্টেড নয়",
            shareFailed: "রেস্টুরেন্ট শেয়ার করা যায়নি"
          },
          summary: {
            subtotal: "সাবটোটাল",
            deliveryFee: "ডেলিভারি ফি",
            tax: "ট্যাক্স",
            discount: "ছাড়",
            couponApplied: "কুপন প্রয়োগ হয়েছে",
            total: "মোট"
          },
          status: {
            deliveredWithIcon: "✓ ডেলিভার হয়েছে",
            restaurantCancelledWithIcon: "✗ রেস্টুরেন্ট বাতিল করেছে",
            cancelledByYouWithIcon: "✗ আপনি বাতিল করেছেন",
            cancelledWithIcon: "✗ বাতিল",
            restaurantCancelled: "রেস্টুরেন্ট বাতিল",
            paymentFailed: "পেমেন্ট ব্যর্থ",
            orderDelivered: "অর্ডার ডেলিভার হয়েছে",
            preparing: "প্রস্তুত হচ্ছে",
            outForDelivery: "ডেলিভারির পথে",
            orderConfirmed: "অর্ডার নিশ্চিত"
          },
          rating: {
            title: "আপনার অর্ডার রেট করুন",
            orderLabel: "অর্ডার",
            experienceQuestion: "আপনার সামগ্রিক অভিজ্ঞতা কেমন ছিল?",
            poor: "খারাপ",
            average: "গড়",
            excellent: "দারুণ",
            shareFeedback: "আপনার মতামত জানান",
            feedbackPlaceholder: "এই অর্ডার সম্পর্কে আপনার কী ভালো বা খারাপ লেগেছে? আপনার অভিজ্ঞতা শেয়ার করুন...",
            feedbackHint: "আপনার ফিডব্যাক আমাদের সেবা উন্নত করতে সাহায্য করে",
            submitting: "সাবমিট হচ্ছে...",
            submit: "রেটিং সাবমিট করুন",
            selectToContinue: "চালিয়ে যেতে একটি রেটিং নির্বাচন করুন",
            selectFirst: "আগে একটি রেটিং নির্বাচন করুন",
            thanks: "রেটিং দেওয়ার জন্য ধন্যবাদ! 🎉",
            submitFailed: "রেটিং সাবমিট করা যায়নি। আবার চেষ্টা করুন।",
            legend: {
              five: "⭐⭐⭐⭐⭐ দারুণ!",
              four: "⭐⭐⭐⭐ খুব ভালো!",
              three: "⭐⭐⭐ ভালো",
              two: "⭐⭐ মোটামুটি",
              one: "⭐ খারাপ"
            }
          }
        },
        cart: {
          error: {
            title: "কার্ট ত্রুটি",
            description: "কার্ট ফিচার বর্তমানে উপলভ্য নয়। দয়া করে পেজ রিফ্রেশ করুন।",
            goHome: "হোমে যান"
          },
          paymentOptions: {
            razorpay: {
              label: "রেজরপে",
              description: "তাৎক্ষণিক অনলাইন পেমেন্ট করুন"
            },
            wallet: {
              label: "ওয়ালেট",
              description: "আপনার ওয়ালেট ব্যালেন্স ব্যবহার করুন",
              balanceAvailable: "উপলভ্য ব্যালেন্স: Rs {{amount}}"
            },
            cash: {
              label: "ক্যাশ অন ডেলিভারি",
              description: "অর্ডার পৌঁছালে পেমেন্ট করুন"
            }
          }
        },
        orderHelp: {
          na: "N/A",
          title: "Order Help",
          orderWithId: "Order {{id}}",
          orderSummary: "Order Summary",
          orderId: "Order ID",
          placedOn: "Placed On",
          totalAmount: "Total Amount",
          items: "Items",
          itemsCount_one: "{{count}} item",
          itemsCount_other: "{{count}} items",
          deliveryAddress: "Delivery Address",
          whatCanWeHelpWith: "What can we help you with?",
          whatToDo: "What to do:",
          quickActions: "Quick Actions",
          trackOrderDescription: "View real-time status",
          viewInvoiceDescription: "Download receipt",
          contactSupportDescription: "Get help now",
          contactSupportForOrder: "Contact Support for This Order",
          supportReadyDescription: "Our support team is ready to help you with order {{id}}",
          phoneSupport: "Phone Support",
          mentionOrder: "Mention order {{id}}",
          emailSupport: "Email Support",
          includeOrderInSubject: "Include order {{id}} in subject",
          startLiveChat: "Start Live Chat",
          backToAllOrders: "Back to All Orders",
          helpCenter: "Help Center",
          orderNotFound: "Order Not Found",
          orderNotFoundDescription: "We couldn't find an order with ID: {{orderId}}",
          viewAllOrders: "View All Orders",
          goToHelpCenter: "Go to Help Center",
          status: {
            confirmed: "Confirmed",
            preparing: "Preparing",
            outForDelivery: "Out for Delivery",
            delivered: "Delivered"
          },
          toast: {
            refundRequestPlaceholder: "Refund request would be processed here. Contact support for assistance.",
            liveChatPlaceholder: "Live chat would open here with order context"
          },
          actions: {
            trackOrder: "Track Order",
            contactSupport: "Contact Support",
            viewInvoice: "View Invoice",
            reportIssue: "Report Issue",
            viewOrderDetails: "View Order Details",
            requestRefund: "Request Refund",
            viewOrder: "View Order"
          },
          issues: {
            "late-delivery": {
              title: "Order is Late",
              description: "Your order hasn't arrived within the estimated time",
              solutions: {
                1: "Check the order tracking page for real-time updates",
                2: "Contact the delivery driver if contact information is available",
                3: "Wait an additional 15-20 minutes as delays can occur",
                4: "Contact support if the order is more than 30 minutes late"
              }
            },
            "missing-items": {
              title: "Missing Items",
              description: "Some items from your order are missing",
              solutions: {
                1: "Check your order receipt to verify what was ordered",
                2: "Check if items were delivered separately",
                3: "Contact support immediately with your order number",
                4: "Take photos if possible to help with the investigation"
              }
            },
            "wrong-order": {
              title: "Wrong Order Received",
              description: "You received items different from what you ordered",
              solutions: {
                1: "Keep the incorrect order - you won't be charged for it",
                2: "Contact support immediately with your order number",
                3: "We'll arrange a replacement or full refund",
                4: "You may be eligible for a discount on your next order"
              }
            },
            "quality-issue": {
              title: "Quality Issue",
              description: "Food quality doesn't meet expectations",
              solutions: {
                1: "Contact support within 24 hours of delivery",
                2: "Describe the issue in detail",
                3: "Take photos if possible",
                4: "We'll process a full refund or replacement"
              }
            },
            "payment-issue": {
              title: "Payment Problem",
              description: "Issues with payment or billing",
              solutions: {
                1: "Check your payment method in your profile",
                2: "Verify the charge on your bank statement",
                3: "Contact support if you were charged incorrectly",
                4: "We'll investigate and process a refund if needed"
              }
            },
            "cancel-order": {
              title: "Cancel Order",
              description: "Need to cancel your order",
              solutions: {
                1: "Orders can be cancelled within 5 minutes of placement",
                2: "After 5 minutes, contact support for cancellation",
                3: "If the order is already being prepared, cancellation may not be possible",
                4: "Refunds are processed automatically for cancelled orders"
              }
            }
          }
        },
        help: {
          title: "Help Center",
          subtitle: "Find answers to common questions or contact our support team",
          searchPlaceholder: "Search for help topics, questions, or keywords...",
          browseByCategory: "Browse by Category",
          noResultsFound: "No results found",
          tryDifferentKeywords: "Try searching with different keywords",
          clearSearch: "Clear Search",
          stillNeedHelp: "Still Need Help?",
          supportAvailable: "Our support team is here to assist you 24/7",
          phoneSupport: "Phone Support",
          phoneSupportDescription: "Call us anytime",
          emailSupport: "Email Support",
          emailSupportDescription: "We'll respond within 24 hours",
          liveChat: "Live Chat",
          liveChatDescription: "Available 24/7",
          liveChatPlaceholder: "Live chat would open here",
          startChat: "Start Chat",
          averageResponseTime: "Average response time: Less than 5 minutes",
          quickActions: {
            trackOrder: "Track Your Order",
            trackOrderDescription: "View order status",
            manageAccount: "Manage Account",
            manageAccountDescription: "Update profile & settings",
            contactSupport: "Contact Support",
            contactSupportDescription: "Get help from our team"
          },
          categories: {
            ordering: {
              title: "Ordering",
              description: "Learn how to place and manage orders",
              topics: {
                1: { question: "How do I place an order?", answer: "To place an order, browse restaurants, add items to your cart, and proceed to checkout. Select your delivery address and payment method, then confirm your order." },
                2: { question: "Can I modify or cancel my order?", answer: "You can modify or cancel your order within 5 minutes of placing it. After that, please contact support for assistance." },
                3: { question: "How do I track my order?", answer: "Go to 'My Orders' in your profile, select the order you want to track, and you'll see real-time updates on your order status." },
                4: { question: "What is the minimum order amount?", answer: "The minimum order amount varies by restaurant, typically ranging from $10 to $15. This information is displayed on each restaurant's page." }
              }
            },
            payments: {
              title: "Payments",
              description: "Payment methods and billing questions",
              topics: {
                1: { question: "What payment methods do you accept?", answer: "We accept all major credit cards, debit cards, digital wallets (Apple Pay, Google Pay), and cash on delivery in select areas." },
                2: { question: "Is my payment information secure?", answer: "Yes, we use industry-standard encryption to protect your payment information. We never store your full card details." },
                3: { question: "Can I get a refund?", answer: "Refunds are processed for cancelled orders, incorrect items, or quality issues. Contact support within 24 hours of delivery for assistance." },
                4: { question: "Why was my payment declined?", answer: "Payment can be declined due to insufficient funds, incorrect card details, or bank restrictions. Please verify your payment method and try again." }
              }
            },
            delivery: {
              title: "Delivery",
              description: "Delivery times, fees, and tracking",
              topics: {
                1: { question: "What are your delivery times?", answer: "Delivery times typically range from 30-60 minutes, depending on the restaurant and your location. Estimated time is shown before checkout." },
                2: { question: "How much is the delivery fee?", answer: "Delivery fees vary by restaurant and distance, typically ranging from $2.99 to $5.99. The exact fee is shown before you place your order." },
                3: { question: "What if my order is late?", answer: "If your order is significantly delayed, contact support. We'll investigate and may provide compensation or a refund." }
              }
            },
            account: {
              title: "Account & Profile",
              description: "Manage your account and preferences",
              topics: {
                1: { question: "How do I update my profile?", answer: "Go to 'Profile' in the menu, then select 'Edit Profile' to update your name, email, phone number, and other information." },
                2: { question: "How do I change my password?", answer: "Go to Profile > Settings > Security to change your password. You'll need to verify your current password first." },
                3: { question: "How do I manage my addresses?", answer: "Navigate to Profile > Addresses to view, add, edit, or delete delivery addresses. Set a default address for faster checkout." },
                4: { question: "How do I save my favorite restaurants?", answer: "Click the heart icon on any restaurant page to add it to your favorites. View all favorites in Profile > Favorites." }
              }
            },
            refunds: {
              title: "Refunds & Returns",
              description: "Refund policy and return process",
              topics: {
                1: { question: "What is your refund policy?", answer: "We offer full refunds for cancelled orders, incorrect items, or quality issues reported within 24 hours of delivery." },
                2: { question: "How long do refunds take?", answer: "Refunds are typically processed within 5-7 business days, depending on your payment method. You'll receive a confirmation email." },
                3: { question: "Can I return food items?", answer: "Due to food safety regulations, we cannot accept returns of food items. However, we'll provide a full refund for quality issues." },
                4: { question: "What if I received the wrong order?", answer: "Contact support immediately with your order number. We'll arrange a replacement or full refund, and you can keep the incorrect order." }
              }
            },
            general: {
              title: "General Questions",
              description: "Other frequently asked questions",
              topics: {
                1: { question: "Do you offer discounts or promotions?", answer: "Yes! Check the 'Offers' section for current promotions, discount codes, and special deals from restaurants." },
                2: { question: "How do I contact customer support?", answer: "You can contact us via phone, email, or live chat. Visit the 'Contact Support' section below for all contact options." },
                3: { question: "Is there a mobile app?", answer: "Yes, our mobile app is available for iOS and Android. Download it from the App Store or Google Play for the best experience." },
                4: { question: "Do you deliver to my area?", answer: "Enter your delivery address to see available restaurants in your area. We're constantly expanding our delivery zones." }
              }
            }
          }
        },
        profile: {
          defaultUserName: "ইউজার",
          notAvailable: "উপলব্ধ নয়",
          walletMoney: "{{companyName}} মানি",
          yourCoupons: "আপনার কুপন",
          yourCart: "আপনার কার্ট",
          yourProfile: "আপনার প্রোফাইল",
          profileCompletion: "{{percent}}% সম্পন্ন",
          vegMode: "ভেজ মোড",
          on: "চালু",
          off: "বন্ধ",
          collections: "কালেকশনস",
          yourCollections: "আপনার কালেকশনস",
          foodOrders: "ফুড অর্ডার্স",
          yourOrders: "আপনার অর্ডার",
          more: "আরও",
          about: "সম্পর্কে",
          sendFeedback: "ফিডব্যাক পাঠান",
          reportSafetyEmergency: "নিরাপত্তা জরুরি অবস্থা রিপোর্ট করুন",
          settings: "সেটিংস",
          loggingOut: "লগআউট হচ্ছে...",
          logOut: "লগ আউট",
          vegModeDescription: "আপনার ডায়েট পছন্দ অনুযায়ী রেস্টুরেন্ট ও ডিশ ফিল্টার করুন",
          vegModeOnTitle: "ভেজ মোড চালু",
          vegModeOnDescription: "শুধু নিরামিষ অপশন দেখান",
          vegModeOffTitle: "ভেজ মোড বন্ধ",
          vegModeOffDescription: "সব অপশন দেখান",
          appearance: {
            title: "অ্যাপিয়ারেন্স",
            description: "আপনার পছন্দের থিম বেছে নিন",
            value: {
              light: "লাইট",
              dark: "ডার্ক"
            },
            light: "লাইট",
            lightDescription: "ডিফল্ট লাইট থিম",
            dark: "ডার্ক",
            darkDescription: "ডার্ক থিম"
          }
        }
      },
      admin: {
        settings: {
          title: "সেটিংস",
          subtitle: "আপনার অ্যাকাউন্ট সেটিংস ও পছন্দসমূহ পরিচালনা করুন",
          changePassword: "পাসওয়ার্ড পরিবর্তন",
          changePasswordDescription: "অ্যাকাউন্ট নিরাপদ রাখতে পাসওয়ার্ড আপডেট করুন",
          currentPassword: "বর্তমান পাসওয়ার্ড",
          currentPasswordPlaceholder: "বর্তমান পাসওয়ার্ড লিখুন",
          newPassword: "নতুন পাসওয়ার্ড",
          newPasswordPlaceholder: "নতুন পাসওয়ার্ড লিখুন",
          confirmPassword: "নতুন পাসওয়ার্ড নিশ্চিত করুন",
          confirmPasswordPlaceholder: "নতুন পাসওয়ার্ড নিশ্চিত করুন",
          passwordHint: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
          changingPassword: "পাসওয়ার্ড পরিবর্তন হচ্ছে...",
          changePasswordAction: "পাসওয়ার্ড পরিবর্তন করুন",
          accountSettings: "অ্যাকাউন্ট সেটিংস",
          accountSettingsDescription: "অতিরিক্ত অ্যাকাউন্ট সেটিংস ও পছন্দসমূহ",
          moreSettingsSoon: "আরও সেটিংস শীঘ্রই উপলব্ধ হবে।",
          validation: {
            currentRequired: "বর্তমান পাসওয়ার্ড প্রয়োজন",
            newRequired: "নতুন পাসওয়ার্ড প্রয়োজন",
            minLength: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে",
            confirmRequired: "অনুগ্রহ করে নতুন পাসওয়ার্ড নিশ্চিত করুন",
            mismatch: "পাসওয়ার্ড মিলছে না",
            mustDiffer: "নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের থেকে আলাদা হতে হবে"
          },
          toast: {
            passwordUpdated: "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে",
            passwordUpdateFailed: "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে"
          }
        },
        coupons: {
          title: "কুপন ও অফার",
          subtitle: "রেস্টুরেন্ট অফার থেকে আলাদা করে অ্যাডমিন কুপন ম্যানেজ করুন।",
          tabs: {
            adminCoupons: "অ্যাডমিন কুপন",
            restaurantOffers: "রেস্টুরেন্ট অফার"
          },
          search: {
            adminPlaceholder: "কোড, শিরোনাম বা বর্ণনা দিয়ে খুঁজুন...",
            restaurantPlaceholder: "রেস্টুরেন্ট, ডিশ বা কুপন কোড দিয়ে খুঁজুন..."
          },
          form: {
            createTitle: "কাস্টমার কুপন তৈরি করুন",
            editTitle: "কাস্টমার কুপন সম্পাদনা করুন",
            fields: {
              couponCode: "কুপন কোড",
              title: "শিরোনাম",
              eligibility: "যোগ্যতা",
              discountType: "ডিসকাউন্ট ধরন",
              discountPercent: "ডিসকাউন্ট %",
              discountAmount: "ডিসকাউন্ট পরিমাণ",
              maxDiscountAmount: "সর্বোচ্চ ডিসকাউন্ট পরিমাণ",
              minOrderValue: "সর্বনিম্ন অর্ডার মূল্য",
              validFrom: "শুরু থেকে",
              validUntil: "শেষ পর্যন্ত",
              description: "বিবরণ"
            },
            placeholders: {
              couponCode: "FIRST20",
              title: "প্রথম অর্ডারে 20% ছাড়",
              discountPercent: "20",
              discountAmount: "100",
              optional: "ঐচ্ছিক",
              description: "কার্ট কুপন সেকশনে ইউজারকে দেখানো হবে"
            },
            cancelEdit: "এডিট বাতিল করুন",
            saving: "সেভ হচ্ছে...",
            saveChanges: "পরিবর্তন সেভ করুন",
            createCta: "কুপন তৈরি করুন"
          },
          eligibility: {
            firstDeliveredOnly: "শুধু প্রথম ডেলিভার্ড অর্ডার",
            firstDelivered: "প্রথম ডেলিভার্ড অর্ডার",
            allUsers: "সব ইউজার"
          },
          discountType: {
            percentage: "শতাংশ",
            flat: "ফ্ল্যাট পরিমাণ"
          },
          count: {
            coupon: "কুপন",
            coupons: "কুপন",
            offer: "অফার",
            offers: "অফার"
          },
          loading: {
            customerCoupons: "কাস্টমার কুপন লোড হচ্ছে...",
            restaurantOffers: "রেস্টুরেন্ট অফার লোড হচ্ছে..."
          },
          empty: {
            adminCoupons: "এখনও কোনো অ্যাডমিন কুপন তৈরি হয়নি",
            restaurantOffers: "কোনো রেস্টুরেন্ট অফার পাওয়া যায়নি"
          },
          table: {
            code: "কোড",
            title: "শিরোনাম",
            eligibility: "যোগ্যতা",
            discount: "ডিসকাউন্ট",
            max: "সর্বোচ্চ",
            minOrder: "ন্যূনতম অর্ডার",
            deliveredUses: "ডেলিভার্ড ব্যবহার",
            status: "স্ট্যাটাস",
            validUntil: "শেষ তারিখ",
            actions: "অ্যাকশন",
            noExpiry: "কোনো মেয়াদ নেই"
          },
          restaurantTable: {
            title: "রেস্টুরেন্ট অফার ও কুপন",
            si: "ক্রম",
            restaurant: "রেস্টুরেন্ট",
            dish: "ডিশ",
            couponCode: "কুপন কোড",
            discount: "ডিসকাউন্ট",
            price: "দাম",
            status: "স্ট্যাটাস",
            validUntil: "শেষ তারিখ"
          },
          actions: {
            edit: "এডিট"
          },
          status: {
            draft: "ড্রাফট",
            active: "সক্রিয়",
            paused: "বিরত",
            expired: "মেয়াদোত্তীর্ণ",
            cancelled: "বাতিল",
            inactive: "নিষ্ক্রিয়"
          },
          currency: {
            rs: "৳"
          },
          common: {
            off: "ছাড়"
          },
          errors: {
            fetchData: "কুপন ডাটা আনতে ব্যর্থ",
            saveCoupon: "কাস্টমার কুপন সেভ করতে ব্যর্থ",
            updateStatus: "কুপনের স্ট্যাটাস আপডেট করতে ব্যর্থ"
          }
        },
        category: {
          title: {
            page: "ক্যাটাগরি",
            list: "ক্যাটাগরি তালিকা"
          },
          search: {
            placeholder: "যেমন: ক্যাটাগরি"
          },
          common: {
            na: "N/A",
            thisCategory: "এই ক্যাটাগরি"
          },
          table: {
            sl: "ক্রম",
            image: "ছবি",
            name: "শিরোনাম",
            type: "ধরন",
            status: "স্ট্যাটাস",
            action: "অ্যাকশন",
            id: "ID"
          },
          status: {
            active: "সক্রিয়",
            inactive: "নিষ্ক্রিয়"
          },
          actions: {
            export: "এক্সপোর্ট",
            addNew: "নতুন ক্যাটাগরি যোগ করুন",
            clickToDeactivate: "নিষ্ক্রিয় করতে ক্লিক করুন",
            clickToActivate: "সক্রিয় করতে ক্লিক করুন",
            edit: "এডিট",
            delete: "ডিলিট",
            close: "বন্ধ করুন",
            showResults: "ফলাফল দেখান",
            cancel: "বাতিল",
            update: "আপডেট",
            create: "তৈরি করুন"
          },
          loading: {
            categories: "ক্যাটাগরি লোড হচ্ছে..."
          },
          empty: {
            noData: "কোনো ডেটা পাওয়া যায়নি",
            noMatch: "আপনার খোঁজের সাথে কোনো ক্যাটাগরি মেলেনি"
          },
          export: {
            generatedOn: "তৈরি হয়েছে: {{date}}"
          },
          confirm: {
            delete: "আপনি কি \"{{categoryName}}\" মুছে ফেলতে চান? এই কাজটি ফেরানো যাবে না।"
          },
          success: {
            statusUpdated: "ক্যাটাগরির স্ট্যাটাস সফলভাবে আপডেট হয়েছে",
            deleted: "ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে",
            exported: "PDF সফলভাবে এক্সপোর্ট হয়েছে!",
            updated: "ক্যাটাগরি সফলভাবে আপডেট হয়েছে",
            created: "ক্যাটাগরি সফলভাবে তৈরি হয়েছে"
          },
          errors: {
            loginRequired: "ক্যাটাগরিতে প্রবেশ করতে লগইন করুন",
            loadFailed: "ক্যাটাগরি লোড করতে ব্যর্থ",
            authRequired: "অথেন্টিকেশন প্রয়োজন। আবার লগইন করুন।",
            accessDenied: "অ্যাক্সেস নিষিদ্ধ। আপনার অনুমতি নেই।",
            endpointNotFound: "ক্যাটাগরি এন্ডপয়েন্ট পাওয়া যায়নি। ব্যাকএন্ড সার্ভার চেক করুন।",
            serverError: "সার্ভার ত্রুটি। পরে আবার চেষ্টা করুন।",
            loadWithStatus: "ত্রুটি {{status}}: ক্যাটাগরি লোড করতে ব্যর্থ",
            network: "সার্ভারে সংযোগ করা যায়নি। ব্যাকএন্ড {{host}} এ চলছে কি না দেখুন।",
            updateStatusFailed: "ক্যাটাগরির স্ট্যাটাস আপডেট করতে ব্যর্থ",
            deleteFailed: "ক্যাটাগরি মুছতে ব্যর্থ",
            exportFailed: "PDF এক্সপোর্ট করতে ব্যর্থ",
            invalidFileType: "অবৈধ ফাইল টাইপ। PNG, JPG, JPEG, বা WEBP আপলোড করুন।",
            fileTooLarge: "ফাইল সাইজ 5MB সীমা ছাড়িয়ে গেছে।",
            saveFailed: "ক্যাটাগরি সেভ করতে ব্যর্থ",
            saveWithStatus: "ত্রুটি {{status}}: ক্যাটাগরি সেভ করতে ব্যর্থ"
          },
          filters: {
            title: "ফিল্টার",
            modalTitle: "ফিল্টার ও সাজানো",
            clearAll: "সব মুছুন",
            sortBy: "এই অনুযায়ী সাজান",
            deliveryTime: "ডেলিভারি সময়",
            restaurantRating: "রেস্টুরেন্ট রেটিং",
            distance: "দূরত্ব",
            dishPrice: "ডিশের দাম",
            cuisine: "কুইজিন",
            trustMarkers: "ট্রাস্ট মার্কার",
            tabs: {
              sortBy: "সাজানো",
              time: "সময়",
              rating: "রেটিং",
              distance: "দূরত্ব",
              dishPrice: "দাম",
              cuisine: "কুইজিন",
              offers: "অফার",
              trust: "ট্রাস্ট"
            },
            options: {
              relevance: "প্রাসঙ্গিকতা",
              priceLowToHigh: "দাম: কম থেকে বেশি",
              priceHighToLow: "দাম: বেশি থেকে কম",
              ratingHighToLow: "রেটিং: বেশি থেকে কম",
              ratingLowToHigh: "রেটিং: কম থেকে বেশি",
              under30: "৩০ মিনিটের কম",
              under45: "৪৫ মিনিটের কম",
              rated35: "রেটেড 3.5+",
              rated40: "রেটেড 4.0+",
              rated45: "রেটেড 4.5+",
              under1km: "১ কিমির কম",
              under2km: "২ কিমির কম",
              under1kmShort: "১কিমির কম",
              under2kmShort: "২কিমির কম",
              under200: "৳200 এর কম",
              under500: "৳500 এর কম",
              topRated: "সর্বোচ্চ রেটেড",
              trustedByUsers: "1000+ ইউজার দ্বারা বিশ্বস্ত"
            }
          },
          modal: {
            editTitle: "ক্যাটাগরি সম্পাদনা করুন",
            createTitle: "নতুন ক্যাটাগরি যোগ করুন",
            fields: {
              categoryType: "ক্যাটাগরি টাইপ *",
              selectCategoryType: "ক্যাটাগরি টাইপ নির্বাচন করুন",
              categoryName: "ক্যাটাগরির নাম *",
              categoryNamePlaceholder: "ক্যাটাগরির নাম লিখুন",
              description: "বিবরণ",
              descriptionPlaceholder: "ঐচ্ছিক বিবরণ",
              categoryImage: "ক্যাটাগরির ছবি",
              categoryPreviewAlt: "ক্যাটাগরি প্রিভিউ",
              changeImage: "ছবি পরিবর্তন করুন",
              uploadImage: "ছবি আপলোড করুন",
              supportedFormats: "সমর্থিত ফরম্যাট: PNG, JPG, JPEG, WEBP (সর্বোচ্চ 5MB)",
              activeStatus: "সক্রিয় স্ট্যাটাস"
            },
            types: {
              starters: "স্টার্টার",
              mainCourse: "মেইন কোর্স",
              desserts: "ডেজার্ট",
              beverages: "বেভারেজ",
              varieties: "ভ্যারাইটি"
            }
          }
        }
      },
      delivery: {
        changeLanguage: {
          title: "ভাষা পরিবর্তন করুন",
          subtitle: "অ্যাপের জন্য আপনার পছন্দের ভাষা বেছে নিন",
          restartNotice: "ভাষা প্রয়োগ করতে অ্যাপটি রিফ্রেশ হবে।",
          saving: "ভাষা সেভ করা হচ্ছে..."
        },
        settingsPage: {
          title: "সেটিংস",
          options: {
            notifications: {
              label: "পুশ নোটিফিকেশন",
              description: "নতুন অর্ডার সম্পর্কে নোটিফিকেশন পান"
            },
            locationServices: {
              label: "লোকেশন সার্ভিস",
              description: "অ্যাপকে আপনার লোকেশন অ্যাক্সেস করতে দিন"
            },
            biometricAuth: {
              label: "বায়োমেট্রিক অথেন্টিকেশন",
              description: "লগইনের জন্য ফিঙ্গারপ্রিন্ট বা ফেস আইডি ব্যবহার করুন"
            }
          },
          aria: {
            goBack: "পিছনে যান"
          }
        },
        notificationsPage: {
          title: "নোটিফিকেশন",
          newCount: "{{count}} নতুন",
          empty: "কোনো নোটিফিকেশন নেই",
          time: {
            minutesAgo: "{{count}} মিনিট আগে",
            hoursAgo: "{{count}} ঘন্টা আগে",
            hoursAgo_plural: "{{count}} ঘন্টা আগে",
            daysAgo: "{{count}} দিন আগে",
            daysAgo_plural: "{{count}} দিন আগে"
          },
          items: {
            newOrderRequest: {
              title: "নতুন অর্ডার রিকোয়েস্ট",
              message: "আপনার কাছে {{restaurant}} থেকে নতুন অর্ডার রিকোয়েস্ট এসেছে। অর্ডার #{{orderId}}"
            },
            orderDelivered: {
              title: "অর্ডার ডেলিভার্ড",
              message: "অর্ডার #{{orderId}} সফলভাবে ডেলিভারি হয়েছে। প্রাপ্ত পেমেন্ট: ₹ {{amount}}"
            },
            paymentPending: {
              title: "পেমেন্ট পেন্ডিং",
              message: "অর্ডার #{{orderId}}-এর পেমেন্ট এখনও বাকি। অনুগ্রহ করে গ্রাহকের কাছ থেকে সংগ্রহ করুন।"
            },
            systemUpdate: {
              title: "সিস্টেম আপডেট",
              message: "ডেলিভারি অ্যাপে নতুন ফিচার যোগ হয়েছে। দেখে নিন!"
            },
            orderCancelled: {
              title: "অর্ডার বাতিল",
              message: "অর্ডার #{{orderId}} গ্রাহক বাতিল করেছেন।"
            },
            withdrawalSuccessful: {
              title: "উত্তোলন সফল",
              message: "₹ {{amount}} টাকার আপনার উত্তোলন সফলভাবে প্রসেস হয়েছে।"
            },
            profileUpdated: {
              title: "প্রোফাইল আপডেট হয়েছে",
              message: "আপনার প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে।"
            }
          },
          aria: {
            goBack: "পিছনে যান"
          }
        }
      },
      restaurant: {
        changeLanguage: {
          title: "ভাষা পরিবর্তন করুন",
          subtitle: "অ্যাপের জন্য আপনার পছন্দের ভাষা বেছে নিন",
          restartNotice: "ভাষা প্রয়োগ করতে অ্যাপটি রিফ্রেশ হবে।",
          saving: "ভাষা সেভ করা হচ্ছে..."
        },
        editRestaurant: {
          title: "রেস্টুরেন্ট সম্পাদনা করুন",
          aria: {
            back: "পিছনে যান"
          },
          languages: {
            english: "ইংরেজি",
            bengali: "বাংলা - বাংলা",
            arabic: "আরবি - العربية",
            spanish: "স্প্যানিশ"
          },
          fields: {
            restaurantName: "রেস্টুরেন্টের নাম",
            restaurantNameWithLang: "রেস্টুরেন্টের নাম ({{language}})",
            contact: "যোগাযোগ",
            phoneNumber: "ফোন নম্বর",
            address: "ঠিকানা",
            restaurantLogo: "রেস্টুরেন্ট লোগো",
            restaurantCover: "রেস্টুরেন্ট কভার",
            metaData: "মেটা ডাটা",
            title: "শিরোনাম",
            description: "বিবরণ",
            metaImage: "মেটা ইমেজ"
          },
          placeholders: {
            restaurantName: "রেস্টুরেন্টের নাম লিখুন",
            phoneNumber: "01747410000",
            address: "ঠিকানা লিখুন",
            metaTitle: "মেটা শিরোনাম লিখুন",
            metaDescription: "মেটা বিবরণ লিখুন"
          },
          hints: {
            logo: "JPG, JPEG, PNG 1MB এর কম (রেশিও 1:1)",
            cover: "JPG, JPEG, PNG 1MB এর কম (রেশিও 2:1)"
          },
          actions: {
            uploadLogo: "লোগো আপলোড করুন",
            uploadCover: "কভার আপলোড করুন",
            uploadMetaImage: "মেটা ইমেজ আপলোড করুন",
            update: "আপডেট"
          },
          alerts: {
            requiredFields: "অনুগ্রহ করে সব প্রয়োজনীয় ফিল্ড পূরণ করুন (রেস্টুরেন্টের নাম, ঠিকানা, ফোন নম্বর)",
            saveFailed: "রেস্টুরেন্ট ডাটা সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
          }
        },
        fssaiDetails: {
          aria: {
            back: "ফিরে যান"
          },
          restaurantName: "কড়াই চামচ রেস্টুরেন্ট",
          location: "বাই পাস রোড (দক্ষিণ), ইন্দোর",
          warning: {
            title: "FSSAI 14 দিনের মধ্যে মেয়াদ শেষ হবে",
            subtitle: "অর্ডার চালু রাখতে মেয়াদ শেষের আগে আপডেট করুন"
          },
          fields: {
            registrationNumber: "FSSAI রেজিস্ট্রেশন নম্বর",
            document: "ডকুমেন্ট",
            validUpto: "কার্যকর থাকবে"
          },
          actions: {
            updateLicense: "FSSAI লাইসেন্স আপডেট করুন",
            notRenewed: "FSSAI এখনও নবায়ন করেননি?",
            applyNow: "এখনই আবেদন করুন"
          }
        },
        dishRatings: {
          aria: {
            goBack: "পিছনে যান"
          },
          restaurantName: "কড়াই চামচ রেস্টুরেন্ট",
          restaurantLocation: "মুসাখেদি, ইদরিশ নগর, বাই পাস রোড (দক্ষিণ), ইন্দোর",
          empty: "এখনও আপনার কোনো ডিশ রেটিং আসেনি"
        },
        shareFeedback: {
          title: "আপনার মতামত শেয়ার করুন",
          aria: {
            close: "বন্ধ করুন"
          },
          subtitlePrefix: "আমাদের বলুন আপনার",
          subtitleMain: "{{companyName}}-এর সাথে সামগ্রিক অভিজ্ঞতা",
          scale: {
            veryBad: "খুব খারাপ",
            veryGood: "খুব ভালো",
            ratedPrefix: "আপনি আপনার অভিজ্ঞতাকে রেট করেছেন",
            ratedSuffix: "।"
          },
          actions: {
            continue: "চালিয়ে যান",
            done: "সম্পন্ন"
          },
          thanks: {
            title: "আপনার মতামতের জন্য ধন্যবাদ",
            subtitle: "এটি {{companyName}}-এর সাথে আপনার অভিজ্ঞতা উন্নত করতে আমাদের সাহায্য করে।"
          },
          toast: {
            saveFailed: "ফিডব্যাক সেভ করা যায়নি, তবে আপনার মতামতের জন্য ধন্যবাদ!"
          }
        },
        fssaiUpdate: {
          title: "FSSAI আপডেট করুন",
          aria: {
            back: "ফিরে যান"
          },
          fields: {
            registrationNumber: "FSSAI রেজিস্ট্রেশন নম্বর",
            validUpto: "কার্যকর থাকবে",
            uploadLicense: "আপনার FSSAI লাইসেন্স আপলোড করুন"
          },
          placeholders: {
            registrationNumber: "যেমন: 19138110019201",
            validUpto: "DD-MM-YYYY"
          },
          hints: {
            fileTypes: "jpeg, png, অথবা pdf (সর্বোচ্চ 5MB)"
          },
          actions: {
            viewGuidelines: "আপলোড নির্দেশিকা দেখুন",
            confirm: "নিশ্চিত করুন"
          }
        },
        editAddress: {
          aria: {
            goBack: "পিছনে যান"
          },
          title: "আউটলেটের ঠিকানা",
          map: {
            title: "আপনার আউটলেট লোকেশন",
            subtitle: "এখান থেকেই অর্ডার পিকআপ হবে"
          },
          fields: {
            buildingStreet: "বিল্ডিং / রাস্তা",
            floorSuite: "ফ্লোর / স্যুট (ঐচ্ছিক)",
            area: "এলাকা",
            city: "শহর",
            landmark: "ল্যান্ডমার্ক"
          },
          placeholders: {
            addressLine1: "বিল্ডিং নাম, রাস্তা ইত্যাদি",
            addressLine2: "ফ্লোর, স্যুট, সাবইউনিট ইত্যাদি",
            area: "এলাকা / লোকালিটি",
            city: "শহর",
            landmark: "কাছাকাছি পরিচিত স্থান"
          },
          actions: {
            updating: "বিস্তারিত আপডেট হচ্ছে...",
            save: "ঠিকানা সেভ করুন"
          },
          toast: {
            updated: "ঠিকানা সফলভাবে আপডেট হয়েছে!",
            updateFailed: "ঠিকানা আপডেট করতে ব্যর্থ",
            updateProfileFailed: "প্রোফাইল আপডেট করতে ব্যর্থ"
          }
        },
        phoneNumbers: {
          aria: {
            goBack: "পিছনে যান"
          },
          title: "গুরুত্বপূর্ণ যোগাযোগ",
          sections: {
            orderReminder: {
              title: "অর্ডার রিমাইন্ডার নম্বর",
              subtitle: "লাইভ অর্ডার সাপোর্ট ও অর্ডার রিমাইন্ডারের জন্য নম্বর সবসময় সচল থাকা উচিত।",
              number1: "অর্ডার রিমাইন্ডার নম্বর #1",
              number2: "অর্ডার রিমাইন্ডার নম্বর #2"
            },
            restaurantPage: {
              title: "রেস্টুরেন্ট পেজ নম্বর",
              subtitle: "Zomato গ্রাহকরা আপনার রেস্টুরেন্টে কল করার জন্য এই নম্বর ব্যবহার করবে।"
            }
          },
          actions: {
            manageStaffContacts: "আপনার স্টাফের যোগাযোগের তথ্য ম্যানেজ করুন",
            cancel: "বাতিল",
            save: "সেভ",
            verify: "যাচাই করুন"
          },
          editModal: {
            title: "ফোন নম্বর এডিট করুন",
            countryCode: "দেশের কোড",
            phoneNumber: "ফোন নম্বর",
            phonePlaceholder: "ফোন নম্বর লিখুন"
          },
          countryModal: {
            title: "দেশের কোড নির্বাচন করুন"
          },
          otpModal: {
            title: "OTP যাচাই করুন",
            subtitle: "আমরা ৬-সংখ্যার OTP পাঠিয়েছি",
            resend: "OTP আবার পাঠান"
          }
        },
        withdrawalHistory: {
          aria: {
            goBack: "পিছনে যান"
          },
          title: "উইথড্রয়াল হিস্ট্রি",
          tabs: {
            pending: "পেন্ডিং উইথড্রয়াল",
            successful: "সফল উইথড্রয়াল"
          },
          loading: "লোড হচ্ছে...",
          labels: {
            requested: "অনুরোধের সময়",
            processed: "প্রসেসড"
          },
          status: {
            pending: "পেন্ডিং",
            approved: "অনুমোদিত",
            processed: "প্রসেসড"
          },
          empty: {
            pending: "কোনো পেন্ডিং উইথড্রয়াল অনুরোধ নেই",
            successful: "কোনো সফল উইথড্রয়াল নেই"
          },
          common: {
            na: "N/A"
          }
        },
        exploreMore: {
          title: "আরও দেখুন",
          common: {
            loading: "লোড হচ্ছে...",
            na: "N/A"
          },
          sections: {
            manageOutlet: "আউটলেট ম্যানেজ",
            settings: "সেটিংস",
            orders: "অর্ডার",
            help: "সাহায্য",
            accounting: "অ্যাকাউন্টিং"
          },
          items: {
            outletInfo: "আউটলেট তথ্য",
            outletTimings: "আউটলেট সময়সূচি",
            manageStaff: "স্টাফ ম্যানেজ",
            zoneSetup: "জোন সেটআপ",
            deliverySetup: "ডেলিভারি সেটআপ",
            changeLanguage: "ভাষা পরিবর্তন",
            orderHistory: "অর্ডার ইতিহাস",
            complaints: "অভিযোগ",
            reviews: "রিভিউ",
            helpCentre: "হেল্প সেন্টার",
            shareFeedback: "আপনার মতামত দিন",
            payout: "পেআউট",
            invoices: "ইনভয়েস",
            subscription: "সাবস্ক্রিপশন"
          },
          search: {
            placeholder: "ফিচার খুঁজুন...",
            noResultsTitle: "কোনো ফল পাওয়া যায়নি",
            noResultsSubtitle: "অন্য কীওয়ার্ড দিয়ে খুঁজে দেখুন",
            idleTitle: "ফিচার খুঁজুন",
            idleSubtitle: "আউটলেট সেটিংস, অর্ডার এবং আরও খুঁজতে টাইপ করুন"
          },
          profile: {
            title: "আমার প্রোফাইল",
            loggingOut: "লগআউট হচ্ছে...",
            logout: "লগআউট",
            logoutAllDevices: "সব ডিভাইস থেকে লগআউট",
            restaurantOwner: "রেস্টুরেন্ট মালিক",
            roleOwner: "মালিক"
          },
          footer: {
            terms: "সেবার শর্তাবলী",
            privacy: "গোপনীয়তা নীতি",
            codeOfConduct: "আচরণবিধি"
          },
          aria: {
            goBack: "পিছনে যান",
            search: "খুঁজুন",
            profile: "প্রোফাইল",
            closeSearch: "সার্চ বন্ধ করুন",
            clearSearch: "সার্চ পরিষ্কার করুন",
            close: "বন্ধ করুন"
          }
        },
        inviteUser: {
          title: "ইউজার যোগ করুন",
          aria: {
            goBack: "পিছনে যান",
            photoPreview: "স্টাফ ছবির প্রিভিউ",
            removePhoto: "ছবি সরান"
          },
          fields: {
            name: "নাম",
            phone: "ফোন নম্বর",
            email: "ইমেইল ঠিকানা",
            photoOptional: "ছবি (ঐচ্ছিক)"
          },
          placeholders: {
            name: "পূর্ণ নাম লিখুন",
            phone: "ফোন নম্বর লিখুন",
            email: "ইমেইল ঠিকানা লিখুন"
          },
          sections: {
            selectRole: "ইউজারের ভূমিকা নির্বাচন করুন"
          },
          roles: {
            staff: "স্টাফ",
            manager: "ম্যানেজার"
          },
          actions: {
            addByEmail: "এর বদলে ইমেইলে যোগ করুন",
            addByPhone: "এর বদলে ফোনে যোগ করুন",
            uploadPhoto: "ছবি আপলোড করুন",
            addUser: "ইউজার যোগ করুন",
            done: "সম্পন্ন"
          },
          validation: {
            phoneRequired: "ফোন নম্বর প্রয়োজন",
            phoneMinLength: "ফোন নম্বর কমপক্ষে ১০ সংখ্যার হতে হবে",
            phoneMaxLength: "ফোন নম্বর খুব বড়",
            emailRequired: "ইমেইল প্রয়োজন",
            emailInvalid: "অনুগ্রহ করে সঠিক ইমেইল ঠিকানা দিন",
            nameRequired: "নাম প্রয়োজন",
            nameMinLength: "নাম কমপক্ষে ২ অক্ষরের হতে হবে",
            invalidServerResponse: "সার্ভার থেকে অবৈধ রেসপন্স এসেছে",
            addFailed: "ইউজার যোগ করা যায়নি। আবার চেষ্টা করুন।"
          },
          success: {
            managerTitle: "ম্যানেজার সফলভাবে যোগ হয়েছে!",
            staffTitle: "স্টাফ সফলভাবে যোগ হয়েছে!",
            description: "{{name}}-কে আপনার আউটলেটে {{role}} হিসেবে সফলভাবে যোগ করা হয়েছে।"
          }
        },
        downloadReport: {
          title: "রিপোর্ট ডাউনলোড করুন",
          aria: {
            back: "ফিরে যান"
          },
          banner: {
            generatingFor: "আপনি রিপোর্ট তৈরি করছেন",
            allOutlets: "সব আউটলেটের জন্য"
          },
          labels: {
            selectReportView: "রিপোর্ট ভিউ নির্বাচন করুন:",
            selectDataView: "ডাটার ভিউ নির্বাচন করুন:",
            selectDuration: "রিপোর্টের সময়কাল নির্বাচন করুন:"
          },
          reportViews: {
            detailed: "বিস্তারিত রিপোর্ট",
            item: "আইটেম বিক্রির রিপোর্ট"
          },
          viewTypes: {
            daily: "দৈনিক",
            weekly: "সাপ্তাহিক",
            monthly: "মাসিক"
          },
          durations: {
            daily: {
              last7: "গত ৭ দিন",
              last14: "গত ১৪ দিন",
              last30: "গত ৩০ দিন"
            },
            weekly: {
              last4w: "গত ৪ সপ্তাহ",
              last8w: "গত ৮ সপ্তাহ",
              last12w: "গত ১২ সপ্তাহ"
            },
            monthly: {
              last3m: "গত ৩ মাস",
              last6m: "গত ৬ মাস",
              last12m: "গত ১২ মাস"
            },
            common: {
              custom: "কাস্টম"
            }
          },
          actions: {
            sendEmail: "ইমেইল পাঠান"
          },
          success: {
            title: "রিপোর্ট কিউতে রাখা হয়েছে",
            subtitle: "আমরা শীঘ্রই এটি আপনাকে ইমেইল করব।"
          }
        },
        notificationRequest: {
          title: "কাস্টমারকে নোটিফাই করুন",
          aria: {
            goBack: "পিছনে যান",
            imagePreview: "প্রিভিউ",
            removeImage: "ছবি সরান",
            deleteRequest: "রিকোয়েস্ট মুছুন"
          },
          common: {
            optional: "ঐচ্ছিক",
            loading: "লোড হচ্ছে..."
          },
          quota: {
            title: "আজকের রিকোয়েস্ট কোটার সীমা",
            subtitle: "মধ্যরাতে রিসেট হবে",
            used: "{{used}}/{{limit}} ব্যবহৃত"
          },
          submit: {
            title: "নোটিফিকেশন রিকোয়েস্ট জমা দিন",
            limitReached: "দৈনিক রিকোয়েস্ট সীমা পূর্ণ হয়েছে। আপনি আগামীকাল আবার জমা দিতে পারবেন।",
            pendingExists: "আপনার একটি রিকোয়েস্ট আগে থেকেই পেন্ডিং আছে। অ্যাডমিন রিভিউয়ের জন্য অপেক্ষা করুন।"
          },
          fields: {
            notificationTitle: "নোটিফিকেশন শিরোনাম",
            description: "বর্ণনা",
            image: "ছবি"
          },
          placeholders: {
            title: "যেমন: আজ সব আইটেমে ৩০% ছাড়!",
            description: "কাস্টমারদের জন্য পরিষ্কার ও আকর্ষণীয় বার্তা লিখুন..."
          },
          upload: {
            helpText: "আপলোড করতে ক্লিক করুন - JPG, PNG বা WEBP, সর্বোচ্চ 5 MB",
            uploading: "আপলোড হচ্ছে...",
            uploaded: "আপলোড সম্পন্ন"
          },
          actions: {
            submitRequest: "রিকোয়েস্ট জমা দিন",
            submitting: "জমা হচ্ছে...",
            imageUploading: "ছবি আপলোড হচ্ছে..."
          },
          requests: {
            title: "আমার রিকোয়েস্ট",
            empty: "এখনও কোনো রিকোয়েস্ট জমা দেওয়া হয়নি।"
          },
          status: {
            pending: "রিভিউ পেন্ডিং",
            approved: "অনুমোদিত ও পাঠানো হয়েছে",
            rejected: "প্রত্যাখ্যাত"
          },
          pagination: {
            pageOf: "পৃষ্ঠা {{page}} / {{total}}",
            prev: "পূর্ববর্তী",
            next: "পরবর্তী"
          },
          validation: {
            imageType: "শুধুমাত্র JPG, PNG, বা WEBP ছবি গ্রহণযোগ্য।",
            imageSize: "ছবির সাইজ 5 MB-এর কম হতে হবে।",
            noUploadUrl: "কোনো URL পাওয়া যায়নি",
            imageUploadFailed: "ছবি আপলোড ব্যর্থ হয়েছে। আপনি ছবি ছাড়াও জমা দিতে পারেন।",
            titleDescriptionRequired: "শিরোনাম এবং বর্ণনা আবশ্যক।",
            imageUploading: "ছবি এখনও আপলোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন।"
          },
          feedback: {
            submitSuccess: "রিকোয়েস্ট সফলভাবে জমা হয়েছে! অ্যাডমিন শীঘ্রই রিভিউ করবে।",
            submitFailed: "রিকোয়েস্ট জমা ব্যর্থ হয়েছে। আবার চেষ্টা করুন।"
          }
        },
        contactDetails: {
          title: "যোগাযোগের বিবরণ",
          sections: {
            owner: "মালিক",
            relationshipManager: "Zapoo রিলেশনশিপ ম্যানেজার",
            manager: "ম্যানেজার",
            staff: "স্টাফ"
          },
          actions: {
            addSomeone: "কাউকে যোগ করুন",
            addUser: "ইউজার যোগ করুন"
          },
          empty: {
            manager: "এখনও কাউকে ম্যানেজার হিসেবে যোগ করা হয়নি।",
            staff: "এখনও কাউকে স্টাফ হিসেবে যোগ করা হয়নি।"
          },
          confirm: {
            removeUser: "আপনি কি নিশ্চিত যে এই ইউজারকে সরাতে চান?"
          },
          errors: {
            deleteFailed: "ইউজার মুছতে ব্যর্থ",
            removeFailed: "ইউজার সরানো যায়নি। আবার চেষ্টা করুন।"
          },
          common: {
            loading: "লোড হচ্ছে...",
            na: "N/A"
          },
          aria: {
            goBack: "পিছনে যান",
            ownerProfile: "মালিকের প্রোফাইল",
            editOwner: "মালিক সম্পাদনা করুন",
            rmProfile: "রিলেশনশিপ ম্যানেজার প্রোফাইল",
            callRm: "রিলেশনশিপ ম্যানেজারকে কল করুন",
            deleteUser: "ইউজার মুছুন"
          }
        },
        updateBank: {
          title: "ব্যাংকের বিবরণ আপডেট করুন",
          aria: {
            back: "ফিরে যান"
          },
          sections: {
            accountInformation: "অ্যাকাউন্ট তথ্য"
          },
          labels: {
            lastUpdatedOn: "সর্বশেষ আপডেট: {{date}}",
            beneficiaryName: "বেনিফিশিয়ারির নাম",
            accountNumber: "অ্যাকাউন্ট নম্বর",
            ifscCode: "IFSC কোড",
            issueHelp: "ব্যাংক বিবরণ সংক্রান্ত কোনো সমস্যা আছে?"
          },
          fields: {
            enterBeneficiaryName: "বেনিফিশিয়ারির নাম লিখুন",
            enterAccountNumber: "অ্যাকাউন্ট নম্বর লিখুন",
            confirmAccountNumber: "অ্যাকাউন্ট নম্বর নিশ্চিত করুন",
            enterIfsc: "IFSC লিখুন"
          },
          actions: {
            editBankDetails: "ব্যাংক বিবরণ সম্পাদনা করুন",
            submit: "সাবমিট করুন"
          },
          validation: {
            beneficiaryRequired: "বেনিফিশিয়ারির নাম প্রয়োজন",
            beneficiaryMinLength: "বেনিফিশিয়ারির নাম কমপক্ষে ৩ অক্ষরের হতে হবে",
            beneficiaryMaxLength: "বেনিফিশিয়ারির নাম ১০০ অক্ষরের কম হতে হবে",
            beneficiaryPattern: "বেনিফিশিয়ারির নামে শুধু অক্ষর, স্পেস এবং ডট থাকতে পারে",
            accountRequired: "অ্যাকাউন্ট নম্বর প্রয়োজন",
            accountDigitsOnly: "অ্যাকাউন্ট নম্বরে শুধুমাত্র সংখ্যা থাকতে হবে",
            accountMinLength: "অ্যাকাউন্ট নম্বর কমপক্ষে ৯ সংখ্যার হতে হবে",
            accountMaxLength: "অ্যাকাউন্ট নম্বর ১৮ সংখ্যার কম হতে হবে",
            confirmRequired: "অনুগ্রহ করে অ্যাকাউন্ট নম্বর নিশ্চিত করুন",
            accountMismatch: "অ্যাকাউন্ট নম্বর মিলছে না",
            ifscRequired: "IFSC কোড প্রয়োজন",
            ifscLength: "IFSC কোড ঠিক ১১ অক্ষরের হতে হবে",
            ifscInvalid: "অবৈধ IFSC কোড ফরম্যাট (যেমন, SBIN0018764)"
          }
        },
        switchOutlet: {
          title: "আউটলেট পরিবর্তন করুন",
          mappedOutlets: "আপনি {{count}} টি আউটলেটে ম্যাপড আছেন",
          mappedOutlets_plural: "আপনি {{count}} টি আউটলেটে ম্যাপড আছেন",
          sample: {
            name: "কড়াই চামচ রেস্টুরেন্ট",
            address: "বাই পাস রোড (দক্ষিণ)"
          },
          labels: {
            outletId: "আউটলেট আইডি"
          },
          status: {
            offline: "অফলাইন",
            online: "অনলাইন"
          },
          helpText: "আপনি যে আউটলেট খুঁজছেন তা পাননি? লগআউট করে অন্য অ্যাকাউন্ট দিয়ে আবার চেষ্টা করুন।",
          actions: {
            showOffline: "বর্তমানে অফলাইন আউটলেট দেখান",
            logout: "লগআউট",
            loggingOut: "লগআউট হচ্ছে..."
          },
          aria: {
            goBack: "পিছনে যান",
            search: "খুঁজুন"
          }
        },
        menuDiscountTiming: {
          pageTitles: {
            percentage: "শতকরা ডিসকাউন্ট",
            flatPrice: "ফ্ল্যাট প্রাইস",
            default: "মেনু ডিসকাউন্ট"
          },
          customerTarget: {
            title: "কাস্টমার টার্গেট",
            allCustomers: "সব কাস্টমার",
            newCustomers: "নতুন কাস্টমার",
            newCustomersHint: "যারা গত ৯০ দিনে অর্ডার করেননি"
          },
          offerTimings: {
            title: "অফারের সময়"
          },
          days: {
            all: "সব দিন",
            monThu: "সোম - বৃহস্পতি",
            friSun: "শুক্র - রবি"
          },
          fields: {
            startDate: "শুরুর তারিখ",
            targetMealtime: "টার্গেট মিলটাইম"
          },
          mealtimes: {
            all: "সব মিলটাইম",
            breakfast: "ব্রেকফাস্ট (8 AM - 11 AM)",
            lunch: "লাঞ্চ (11 AM - 3 PM)",
            snacks: "স্ন্যাক্স (3 PM - 7 PM)",
            dinner: "ডিনার (7 PM - 11 PM)",
            lateNight: "লেট নাইট (11 PM - 6 AM)"
          },
          popup: {
            title: "টার্গেট মিলটাইম নির্বাচন করুন"
          },
          actions: {
            previewOffer: "অফার প্রিভিউ",
            confirm: "নিশ্চিত করুন"
          },
          toast: {
            created: "অফার সফলভাবে তৈরি হয়েছে!"
          }
        },
        notifications: {
          title: "নোটিফিকেশন",
          empty: "কোনো নোটিফিকেশন নেই",
          aria: {
            back: "ফিরে যান"
          }
        },
        status: {
          title: "রেস্টুরেন্ট স্ট্যাটাস",
          mappedRestaurants: "আপনি {{count}} টি রেস্টুরেন্টে ম্যাপড আছেন",
          mappedRestaurants_plural: "আপনি {{count}} টি রেস্টুরেন্টে ম্যাপড আছেন",
          common: {
            loading: "লোড হচ্ছে...",
            restaurant: "রেস্টুরেন্ট"
          },
          labels: {
            id: "আইডি",
            deliveryStatus: "ডেলিভারি স্ট্যাটাস",
            currentDeliverySlot: "বর্তমান ডেলিভারি স্লট",
            todayOff: "আজ বন্ধ",
            notConfigured: "কনফিগার করা নেই"
          },
          statusText: {
            receiving: "অর্ডার গ্রহণ করা হচ্ছে",
            notReceiving: "অর্ডার গ্রহণ করা হচ্ছে না"
          },
          actions: {
            details: "বিস্তারিত",
            cancel: "বাতিল",
            goToOutletTimings: "আউটলেট টাইমিংসে যান",
            changeOutletTimings: "আউটলেট টাইমিংস পরিবর্তন করুন"
          },
          warnings: {
            outsideTimings: "আপনি বর্তমানে নির্ধারিত ডেলিভারি সময়ের বাইরে আছেন।"
          },
          dialogs: {
            outletClosed: {
              title: "আউটলেট টাইমিংস বন্ধ"
            },
            outsideTimings: {
              title: "ডেলিভারি সময়ের বাইরে",
              description: "আপনি বর্তমানে নির্ধারিত ডেলিভারি সময়ের বাইরে আছেন। ডেলিভারি স্ট্যাটাস চালু করতে আউটলেট টাইমিংস পরিবর্তন করুন।"
            }
          },
          aria: {
            goBack: "পিছনে যান",
            exploreMore: "আরও দেখুন"
          }
        },
        outletTimings: {
          title: "আউটলেট টাইমিংস",
          days: {
            monday: "সোমবার",
            tuesday: "মঙ্গলবার",
            wednesday: "বুধবার",
            thursday: "বৃহস্পতিবার",
            friday: "শুক্রবার",
            saturday: "শনিবার",
            sunday: "রবিবার"
          },
          status: {
            open: "খোলা",
            close: "বন্ধ"
          },
          fields: {
            openingTime: "খোলার সময়",
            closingTime: "বন্ধের সময়"
          },
          placeholders: {
            openingTime: "খোলার সময় নির্বাচন করুন",
            closingTime: "বন্ধের সময় নির্বাচন করুন"
          },
          labels: {
            current: "বর্তমান",
            dayClosed: "এই দিনটি বন্ধ"
          },
          aria: {
            goBack: "পিছনে যান"
          }
        },
        daySlots: {
          description: "এখানে আপনার রেস্টুরেন্টের টাইমিংস যোগ বা পরিবর্তন করুন। এক দিনে সর্বোচ্চ ৩টি টাইম স্লট তৈরি করা যাবে।",
          days: {
            monday: "সোমবার",
            tuesday: "মঙ্গলবার",
            wednesday: "বুধবার",
            thursday: "বৃহস্পতিবার",
            friday: "শুক্রবার",
            saturday: "শনিবার",
            sunday: "রবিবার"
          },
          labels: {
            slot: "স্লট-{{number}}",
            copyToAllDays: "উপরের টাইমিংস সব দিনে কপি করুন",
            total: "মোট"
          },
          fields: {
            startTime: "শুরুর সময়",
            endTime: "শেষের সময়"
          },
          placeholders: {
            startTime: "03:45",
            endTime: "02:15"
          },
          actions: {
            okay: "ঠিক আছে",
            addTimeSlot: "+ টাইম স্লট যোগ করুন",
            save: "সেভ করুন",
            cancel: "বাতিল",
            delete: "মুছুন"
          },
          alerts: {
            maxSlots: "প্রতি দিনে সর্বোচ্চ ৩টি স্লট অনুমোদিত",
            minOneSlot: "কমপক্ষে একটি স্লট প্রয়োজন",
            saveError: "স্লট সেভ করতে ত্রুটি হয়েছে। আবার চেষ্টা করুন।"
          },
          dialog: {
            deleteTitle: "টাইম স্লট মুছুন",
            deleteDescription: "আপনি কি নিশ্চিত যে এই টাইম স্লটটি মুছতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।"
          },
          aria: {
            goBack: "পিছনে যান",
            deleteSlot: "স্লট মুছুন",
            openTimePicker: "টাইম পিকার খুলুন"
          }
        },
        editOwner: {
          title: "যোগাযোগের বিবরণ",
          common: {
            loading: "লোড হচ্ছে..."
          },
          fields: {
            name: "নাম",
            phone: "ফোন নম্বর",
            email: "ইমেইল"
          },
          placeholders: {
            name: "নাম লিখুন",
            phone: "ফোন নম্বর লিখুন",
            email: "ইমেইল ঠিকানা লিখুন"
          },
          actions: {
            editPhoto: "ছবি সম্পাদনা করুন",
            deleteAccount: "আপনার Zomato অ্যাকাউন্ট মুছুন",
            deleting: "মুছে ফেলা হচ্ছে...",
            confirm: "নিশ্চিত করুন",
            cancel: "বাতিল",
            saving: "সেভ হচ্ছে...",
            save: "সেভ করুন"
          },
          deleteDialog: {
            title: "আপনি আপনার Zomato অ্যাকাউন্ট মুছতে যাচ্ছেন",
            description: "আপনার অ্যাকাউন্টের সাথে সম্পর্কিত সব তথ্য মুছে যাবে এবং আপনি স্থায়ীভাবে আপনার রেস্টুরেন্টের অ্যাক্সেস হারাবেন। অ্যাকাউন্ট মুছে গেলে এই তথ্য পুনরুদ্ধার করা যাবে না। আপনি কি নিশ্চিতভাবে এগোতে চান?"
          },
          alerts: {
            uploadImageFailed: "প্রোফাইল ছবি আপলোড করা যায়নি। আবার চেষ্টা করুন।",
            invalidServerResponse: "সার্ভার থেকে অবৈধ রেসপন্স এসেছে",
            saveFailed: "মালিকের তথ্য সেভ করা যায়নি: {{message}}",
            deleteFailed: "অ্যাকাউন্ট মুছতে ব্যর্থ: {{message}}",
            tryAgain: "আবার চেষ্টা করুন।"
          },
          aria: {
            goBack: "পিছনে যান",
            ownerProfile: "মালিকের প্রোফাইল"
          }
        },
        challenges: {
          title: "বিজনেস চ্যালেঞ্জ",
          errors: {
            fetchFailed: "চ্যালেঞ্জ আনা যায়নি",
            unexpected: "চ্যালেঞ্জ আনতে গিয়ে সমস্যা হয়েছে"
          },
          frequency: {
            daily: "দৈনিক",
            weekly: "সাপ্তাহিক",
            monthly: "মাসিক"
          },
          hero: {
            badge: "গ্রোথ বুস্টার",
            title: "আপনার সম্ভাবনা বাড়ান",
            description: "সক্রিয় চ্যালেঞ্জ সম্পূর্ণ করুন, দৃশ্যমানতা বাড়ান, অতিরিক্ত কমিশন অর্জন করুন এবং ব্র্যান্ডকে এগিয়ে নিন। লক্ষ্য পূরণ হলে রিওয়ার্ড স্বয়ংক্রিয়ভাবে প্রয়োগ হবে।",
            totalRewards: "মোট রিওয়ার্ড",
            rank: "র‍্যাঙ্ক"
          },
          filters: {
            all: "সব চ্যালেঞ্জ",
            active: "সক্রিয়",
            completed: "সম্পন্ন"
          },
          labels: {
            target: "টার্গেট",
            rewardFreeBanner: "রিওয়ার্ড: ফ্রি ব্যানার (১ দিন)",
            rewardAmount: "রিওয়ার্ড: ₹{{amount}}",
            progress: "অগ্রগতি",
            expires: "মেয়াদ শেষ",
            freeBanner: "ফ্রি ব্যানার (১ দিন)",
            amountWithCurrency: "₹{{amount}}"
          },
          actions: {
            viewDetails: "বিস্তারিত দেখুন",
            gotIt: "বুঝেছি"
          },
          empty: {
            title: "কোনো চ্যালেঞ্জ পাওয়া যায়নি",
            description: "এই মুহূর্তে {{filter}} চ্যালেঞ্জ নেই। আসন্ন গ্রোথ বুস্টারগুলোর দিকে নজর রাখুন!"
          },
          details: {
            frequency: "ফ্রিকোয়েন্সি",
            target: "টার্গেট",
            reward: "রিওয়ার্ড",
            validity: "ভ্যালিডিটি",
            currentProgress: "বর্তমান অগ্রগতি",
            status: "স্ট্যাটাস"
          },
          common: {
            dash: "—"
          }
        },
        allOrders: {
          common: {
            restaurant: "রেস্টুরেন্ট",
            customer: "গ্রাহক",
            item: "আইটেম",
            addressNotAvailable: "ঠিকানা পাওয়া যায়নি"
          },
          reasons: {
            rejectedByRestaurantWithReason: "রেস্টুরেন্ট দ্বারা বাতিল: {{reason}}",
            cancelledByWithReason: "{{actor}} দ্বারা বাতিল: {{reason}}",
            rejectedByRestaurant: "রেস্টুরেন্ট দ্বারা বাতিল",
            cancelledByCustomer: "গ্রাহক দ্বারা বাতিল"
          },
          labels: {
            showingOrderHistoryFor: "অর্ডার হিস্ট্রি দেখানো হচ্ছে",
            id: "আইডি",
            orderedBy: "অর্ডার করেছেন",
            moreItems: "আরও আইটেম"
          },
          status: {
            pending: "অপেক্ষমান",
            preparing: "প্রস্তুত হচ্ছে",
            ready: "প্রস্তুত",
            outForDelivery: "ডেলিভারির জন্য বেরিয়েছে",
            delivered: "ডেলিভার্ড",
            rejected: "বাতিল",
            cancelled: "রদ্দ",
          },
          tags: {
            cutlery: "কাটলারি",
            expressDelivery: "এক্সপ্রেস ডেলিভারি",
            selfDelivery: "সেল্ফ ডেলিভারি",
            vegOnly: "শুধু ভেজ",
            foodRescue: "ফুড রেস্কিউ",
            irctc: "IRCTC",
            replacement: "রিপ্লেসমেন্ট",
            hospital: "হাসপাতাল",
            largeOrder: "বড় অর্ডার"
          },
          search: {
            placeholder: "অর্ডার আইডি দিয়ে খুঁজুন",
            filterPlaceholder: "খুঁজুন"
          },
          filter: {
            title: "ফিল্টার",
            applied: "{{count}}টি ফিল্টার প্রয়োগ হয়েছে",
            applied_plural: "{{count}}টি ফিল্টার প্রয়োগ হয়েছে",
            categories: {
              orderStatus: "অর্ডারের অবস্থা",
              ratings: "রেটিং",
              kptDelay: "KPT দেরি",
              complaints: "অভিযোগ",
              orderType: "অর্ডারের ধরন"
            },
            options: {
              preparing: "প্রস্তুত হচ্ছে",
              ready: "প্রস্তুত",
              outForDelivery: "ডেলিভারির জন্য বেরিয়েছে",
              delivered: "ডেলিভার্ড",
              rejected: "বাতিল",
              cancelled: "রদ্দ",
              fiveOrLess: "৫★ বা কম",
              fourOrLess: "৪★ বা কম",
              threeOrLess: "৩★ বা কম",
              twoOrLess: "২★ বা কম",
              oneStar: "১★",
              zeroToTen: "০-১০ মিনিট",
              tenToTwenty: "১০-২০ মিনিট",
              twentyToThirty: "২০-৩০ মিনিট",
              thirtyPlus: "৩০+ মিনিট",
              orderDelayed: "অর্ডার দেরিতে এসেছে",
              wrongItems: "ভুল আইটেম ডেলিভার্ড",
              missingItems: "আইটেম অনুপস্থিত/ডেলিভারি হয়নি",
              poorTaste: "স্বাদ বা গুণমান খারাপ",
              poorPackaging: "প্যাকেজিং খারাপ বা লিক হয়েছে",
              outOfStock: "আইটেম স্টকে নেই",
              notDelivered: "অর্ডার ডেলিভারি হয়নি",
              selfDelivery: "সেল্ফ ডেলিভারি",
              foodRescue: "ফুড রেস্কিউ",
              largeOrder: "বড় অর্ডার",
              vegOnly: "শুধু ভেজ",
              irctc: "IRCTC",
              replacement: "রিপ্লেসমেন্ট",
              hospital: "হাসপাতাল"
            }
          },
          dateRange: {
            select: "তারিখের পরিসর নির্বাচন করুন",
            options: {
              last2Days: "গত ২ দিন",
              thisWeek: "এই সপ্তাহ",
              lastWeek: "গত সপ্তাহ",
              last30Days: "গত ৩০ দিন",
              customDateRange: "কাস্টম তারিখ পরিসর"
            }
          },
          loading: {
            orders: "অর্ডার লোড হচ্ছে..."
          },
          errors: {
            fetchOrdersFailed: "অর্ডার আনা যায়নি",
            loadingOrders: "অর্ডার লোড করতে সমস্যা হয়েছে"
          },
          empty: {
            title: "কোনো অর্ডার পাওয়া যায়নি",
            subtitle: "ফিল্টার পরিবর্তন করে দেখুন"
          },
          actions: {
            clearAll: "সব পরিষ্কার করুন",
            clearFilters: "ফিল্টার পরিষ্কার করুন",
            apply: "প্রয়োগ করুন",
            applying: "প্রয়োগ করা হচ্ছে...",
            applyingFilters: "ফিল্টার প্রয়োগ করা হচ্ছে..."
          },
          toast: {
            orderIdCopied: "অর্ডার আইডি ক্লিপবোর্ডে কপি হয়েছে"
          },
          aria: {
            goBack: "পিছনে যান",
            help: "সাহায্য",
            filter: "ফিল্টার",
            copyOrderId: "অর্ডার আইডি কপি করুন",
            close: "বন্ধ করুন"
          }
        },
        helpCentre: {
          title: "হেল্প সেন্টার",
          howCanWeHelp: "আমরা কীভাবে আপনাকে সাহায্য করতে পারি",
          searchPlaceholder: "সমস্যা দিয়ে খুঁজুন",
          empty: "\"{{query}}\" এর সাথে মেলে এমন কোনো টপিক পাওয়া যায়নি",
          topics: {
            outletStatus: {
              title: "আউটলেট অনলাইন / অফলাইন স্ট্যাটাস",
              subtitle: "বর্তমান স্ট্যাটাস ও বিস্তারিত"
            },
            orderIssues: {
              title: "অর্ডার সংক্রান্ত সমস্যা",
              subtitle: "ক্যানসেলেশন ও ডেলিভারি সংক্রান্ত উদ্বেগ"
            },
            restaurant: {
              title: "রেস্টুরেন্ট",
              subtitle: "টাইমিং, যোগাযোগ, FSSAI, ব্যাংক ডিটেইলস, লোকেশন ইত্যাদি"
            },
            menu: {
              title: "মেনু",
              subtitle: "আইটেম, ছবি, দাম, চার্জ ইত্যাদি"
            },
            payments: {
              title: "পেমেন্ট",
              subtitle: "অ্যাকাউন্ট স্টেটমেন্ট, ইনভয়েস ইত্যাদি"
            }
          },
          aria: {
            goBack: "পিছনে যান"
          }
        },
        hyperpure: {
          title: "Hyperpure",
          underDevelopment: "এই পেজটি উন্নয়নাধীন"
        },
        chooseDiscountType: {
          title: "ডিসকাউন্ট টাইপ বেছে নিন",
          choosePromo: "আপনার প্রোমো ডিসকাউন্ট টাইপ বেছে নিন",
          goals: {
            "grow-customers": "গ্রাহক সংখ্যা বাড়ান",
            "increase-value": "অর্ডারের মূল্য বাড়ান",
            "mealtime-orders": "মিলটাইম অর্ডার বাড়ান"
          },
          types: {
            percentage: {
              title: "পার্সেন্টেজ ডিসকাউন্ট",
              description: "'30% OFF up to ₹75' এর মতো প্রোমো ডিসকাউন্ট তৈরি করুন",
              offLabel: "OFF"
            }
          },
          aria: {
            goBack: "পিছনে যান"
          }
        },
        chooseMenuDiscountType: {
          title: "আপনার গ্রাহকদের খুশি করুন",
          chooseMenuDiscount: "আপনার মেনু ডিসকাউন্ট টাইপ বেছে নিন",
          types: {
            freebies: {
              title: "ফ্রিবিজ",
              description: "উচ্চ-মূল্যের গ্রাহকদের খুশি করতে একটি কমপ্লিমেন্টারি ডিশ দিন"
            },
            percentage: {
              title: "পার্সেন্টেজ ডিসকাউন্ট",
              description: "নির্বাচিত আইটেমে ফ্ল্যাট পার্সেন্টেজ ডিসকাউন্ট"
            },
            flatPrice: {
              title: "ফ্ল্যাট প্রাইস",
              description: "₹99, ₹129, ₹129 ইত্যাদির মতো নির্দিষ্ট দামে আইটেম নির্বাচন করুন"
            },
            bogo: {
              title: "BOGO",
              description: "নির্বাচিত আইটেমে Buy 1 Get 1 free অফার"
            }
          },
          aria: {
            goBack: "পিছনে যান"
          }
        },
        hubGrowth: {
          title: "আপনার ব্যবসা বাড়ান",
          buildYourOwn: "নিজে তৈরি করুন",
          cards: {
            offers: {
              title: "অফার এবং ডিসকাউন্ট",
              subtitle: "নিজের অফার শুরু করুন এবং ব্যবসা বাড়ান"
            },
            promotedBanners: {
              title: "প্রমোটেড ব্যানার",
              subtitle: "হোমপেজ ও সার্চে আরও ভালো দৃশ্যমানতা পান"
            },
            notifyCustomers: {
              title: "গ্রাহকদের নোটিফাই করুন",
              subtitle: "সব ব্যবহারকারীর কাছে পুশ নোটিফিকেশন পাঠাতে অ্যাডমিনকে অনুরোধ করুন"
            },
            businessChallenges: {
              title: "বিজনেস চ্যালেঞ্জ",
              subtitle: "মাইলস্টোন পূরণ করে রিওয়ার্ড অর্জন করুন এবং দ্রুত বাড়ুন"
            }
          },
          aria: {
            openMenu: "মেনু খুলুন"
          }
        },
        newOrderNotification: {
          title: "নতুন অর্ডার!",
          orderNumber: "অর্ডার #{{id}}",
          totalAmount: "মোট পরিমাণ",
          items: "আইটেম:",
          moreItems: "আরও আইটেম",
          deliveryCharge: "ডেলিভারি চার্জ",
          distanceKm: "{{km}} কিমি",
          yourDeliveryEarnings: "ডেলিভারি থেকে আপনার আয়",
          deliveryAddress: "ডেলিভারি ঠিকানা",
          address: "ঠিকানা",
          estimatedDelivery: "আনুমানিক ডেলিভারি: {{mins}} মিনিট",
          note: "নোট:",
          payment: {
            cashOnDelivery: "ক্যাশ অন ডেলিভারি",
            onlinePayment: "অনলাইন পেমেন্ট"
          },
          actions: {
            dismiss: "বন্ধ করুন",
            viewOrder: "অর্ডার দেখুন"
          },
          aria: {
            close: "বন্ধ করুন"
          }
        },
        subscriptionFeatureOverlay: {
          title: "প্রিমিয়াম ফিচার",
          message: "এই গ্রোথ টুলটি আনলক করতে আপনার প্ল্যান আপগ্রেড করুন।",
          actions: {
            viewPlans: "সাবস্ক্রিপশন প্ল্যান দেখুন",
            goBack: "পিছনে যান"
          }
        },
        featureLockedScreen: {
          premiumAccess: "প্রিমিয়াম এক্সেস",
          lockedTitle: "{{feature}} লক করা আছে",
          description: "আপনার বর্তমান প্ল্যানে এই ফিচারটি নেই। সঙ্গে সঙ্গে আনলক করতে এবং বাধাহীনভাবে চালিয়ে যেতে আপগ্রেড করুন।",
          upgradeBenefitsTitle: "আপগ্রেডের পর যা পাবেন",
          benefits: {
            fullAccess: "• সীমাবদ্ধ টুলগুলিতে পূর্ণ এক্সেস",
            betterVisibility: "• উন্নত গ্রোথ ও অ্যানালিটিক্স দৃশ্যমানতা",
            continuousAccess: "• কোনো বিঘ্ন ছাড়া ধারাবাহিক ফিচার এক্সেস"
          },
          features: {
            thisFeature: "এই ফিচার",
            order_management: "অর্ডার ম্যানেজমেন্ট",
            menu_control: "মেনু ম্যানেজমেন্ট",
            basic_reports: "রিপোর্ট",
            marketing_tools: "মার্কেটিং টুলস",
            advanced_analytics: "অ্যাডভান্সড অ্যানালিটিক্স",
            advanced_marketing_tools: "অ্যাডভান্সড মার্কেটিং টুলস",
            relationship_manager: "রিলেশনশিপ ম্যানেজার"
          },
          actions: {
            viewPlans: "সাবস্ক্রিপশন প্ল্যান দেখুন",
            goBack: "পিছনে যান"
          }
        },
        subscriptionExpiryBanner: {
          currentPlan: "বর্তমান প্ল্যান",
          titles: {
            trialExpired: "আপনার ট্রায়াল শেষ হয়েছে",
            trialEndingSoon: "আপনার ফ্রি ট্রায়াল শিগগিরই শেষ হবে",
            planExpired: "আপনার প্ল্যানের মেয়াদ শেষ",
            planEndingSoon: "আপনার প্ল্যান শিগগিরই শেষ হবে"
          },
          subtitles: {
            expired: "বাধাহীন এক্সেস চালিয়ে যেতে একটি সাবস্ক্রিপশন প্ল্যান কিনুন।",
            expiresToday: "আজ মেয়াদ শেষ ({{planName}})। চালিয়ে যেতে প্ল্যান কিনুন।",
            expiresTomorrow: "আগামীকাল মেয়াদ শেষ ({{planName}})। চালিয়ে যেতে প্ল্যান কিনুন।",
            expiresInDays: "{{daysLeft}} দিনের মধ্যে মেয়াদ শেষ ({{planName}})। চালিয়ে যেতে প্ল্যান কিনুন।"
          },
          actions: {
            buyPlan: "প্ল্যান কিনুন"
          }
        }
      }
    }
  }
};
