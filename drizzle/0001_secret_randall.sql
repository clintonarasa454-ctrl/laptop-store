CREATE TABLE `addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(256) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`addressLine` text NOT NULL,
	`city` varchar(128) NOT NULL,
	`postalCode` varchar(32),
	`country` varchar(128) NOT NULL,
	`isDefault` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`description` text,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(256) NOT NULL,
	`productImage` text,
	`price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` varchar(64) NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','payment_confirmed','processing','shipped','out_for_delivery','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`shippingFullName` varchar(256) NOT NULL,
	`shippingPhone` varchar(32) NOT NULL,
	`shippingAddress` text NOT NULL,
	`shippingCity` varchar(128) NOT NULL,
	`shippingPostalCode` varchar(32),
	`shippingCountry` varchar(128) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL,
	`shippingCost` decimal(10,2) NOT NULL DEFAULT '0',
	`total` decimal(10,2) NOT NULL,
	`paymentMethod` enum('mpesa','paypal','stripe','card'),
	`paymentStatus` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`paymentReference` varchar(256),
	`trackingNumber` varchar(128),
	`estimatedDelivery` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`method` enum('mpesa','paypal','stripe','card') NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`transactionId` varchar(256),
	`providerResponse` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`slug` varchar(256) NOT NULL,
	`description` text,
	`shortDescription` text,
	`price` decimal(10,2) NOT NULL,
	`comparePrice` decimal(10,2),
	`stock` int NOT NULL DEFAULT 0,
	`brand` varchar(128),
	`sku` varchar(128),
	`images` json DEFAULT ('[]'),
	`specifications` json DEFAULT ('{}'),
	`rating` decimal(3,2) DEFAULT '0',
	`reviewCount` int DEFAULT 0,
	`featured` boolean DEFAULT false,
	`active` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`title` varchar(256),
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);