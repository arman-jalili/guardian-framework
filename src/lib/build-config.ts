/**
 * Build Configuration Generator
 *
 * Generates language-appropriate build configuration files.
 * Dependencies are matched to the selected interface sub-layers.
 *
 * Canonical Reference: .pi/architecture/modules/project-scaffolding-epic0.md#build-config
 * Last Sync: 2026-06-03
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Language } from "./templates.js";
import { LANGUAGE_DEFAULTS } from "./templates.js";
import { renderTemplate } from "./templates.js";

export interface BuildConfigPlan {
	files: { path: string; content: string }[];
}

function getSubLayerDeps(layers: string[], language: Language): string[] {
	const deps: string[] = [];

	if (language === "java") {
		if (layers.includes("interfaces/http")) {
			deps.push("spring-boot-starter-web");
		}
		if (layers.includes("interfaces/messaging")) {
			deps.push("spring-boot-starter-amqp");
		}
	}

	return deps;
}

/**
 * Generate Java Maven pom.xml.
 */
function generateJavaMavenPom(
	groupId: string,
	artifactId: string,
	version: string,
	layers: string[],
): string {
	const extraDeps = getSubLayerDeps(layers, "java");
	const depXml = extraDeps
		.map(
			(dep) =>
				`        <dependency>\n            <groupId>org.springframework.boot</groupId>\n            <artifactId>${dep}</artifactId>\n        </dependency>`,
		)
		.join("\n\n");

	return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
        <relativePath/>
    </parent>

    <groupId>${groupId}</groupId>
    <artifactId>${artifactId}</artifactId>
    <version>${version}</version>
    <name>${artifactId}</name>

    <properties>
        <java.version>21</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-tracing-bridge-brave</artifactId>
        </dependency>
${depXml ? `\n${depXml}` : ""}
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.jacoco</groupId>
                <artifactId>jacoco-maven-plugin</artifactId>
                <version>0.8.11</version>
                <executions>
                    <execution><goals><goal>prepare-agent</goal></goals></execution>
                    <execution>
                        <id>report</id>
                        <phase>verify</phase>
                        <goals><goal>report</goal></goals>
                    </execution>
                </executions>
            </plugin>
            <plugin>
                <groupId>org.owasp</groupId>
                <artifactId>dependency-check-maven</artifactId>
                <version>9.0.9</version>
                <configuration><failBuildOnCVSS>7</failBuildOnCVSS></configuration>
            </plugin>
            <plugin>
                <groupId>com.diffplug.spotless</groupId>
                <artifactId>spotless-maven-plugin</artifactId>
                <version>2.43.0</version>
                <configuration>
                    <java><palantirJavaFormat/></java>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
}

/**
 * Generate TypeScript package.json.
 */
function generateTypeScriptPackageJson(name: string, version: string, layers: string[]): string {
	const deps: Record<string, string> = {
		hono: "^4.0.0",
		zod: "^3.22.0",
	};
	const devDeps: Record<string, string> = {
		"@types/bun": "latest",
		vitest: "^1.0.0",
		"@biomejs/biome": "^1.5.0",
	};

	if (layers.includes("interfaces/graphql")) {
		deps["graphql-yoga"] = "^5.0.0";
		deps.graphql = "^16.0.0";
	}

	return `${JSON.stringify(
		{
			name,
			version,
			type: "module",
			scripts: {
				build: LANGUAGE_DEFAULTS.typescript.buildCommand,
				test: LANGUAGE_DEFAULTS.typescript.testCommand,
				lint: LANGUAGE_DEFAULTS.typescript.lintCommand,
				format: LANGUAGE_DEFAULTS.typescript.formatCommand,
				"format:check": LANGUAGE_DEFAULTS.typescript.formatCheckCommand,
			},
			dependencies: deps,
			devDependencies: devDeps,
		},
		null,
		2,
	)}\n`;
}

/**
 * Generate build configuration for a project.
 */
export function generateBuildConfig(
	targetDir: string,
	options: {
		language: Language;
		buildTool?: "maven" | "gradle";
		groupId: string;
		projectName: string;
		version: string;
		layers: string[];
		dryRun?: boolean;
	},
): BuildConfigPlan {
	const { language, buildTool, groupId, projectName, version, layers, dryRun } = options;
	const files: { path: string; content: string }[] = [];

	if (language === "java") {
		if (buildTool === "gradle") {
			// Gradle build.gradle
			const gradleContent = `plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'jacoco'
    id 'org.owasp.dependencycheck' version '9.0.9'
}

group = '${groupId}'
version = '${version}'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-validation'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    runtimeOnly 'org.postgresql:postgresql'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
${layers.includes("interfaces/messaging") ? "    implementation 'org.springframework.boot:spring-boot-starter-amqp'\n" : ""}
}

test {
    useJUnitPlatform()
    finalizedBy jacocoTestReport
}
`;
			files.push({ path: path.join(targetDir, "build.gradle"), content: gradleContent });
		} else {
			// Maven pom.xml
			const pomContent = generateJavaMavenPom(groupId, projectName, version, layers);
			files.push({ path: path.join(targetDir, "pom.xml"), content: pomContent });
		}
	} else if (language === "typescript") {
		const packageJson = generateTypeScriptPackageJson(projectName, version, layers);
		files.push({ path: path.join(targetDir, "package.json"), content: packageJson });
	}

	if (!dryRun) {
		for (const file of files) {
			fs.mkdirSync(path.dirname(file.path), { recursive: true });
			fs.writeFileSync(file.path, file.content, "utf-8");
		}
	}

	return { files };
}
