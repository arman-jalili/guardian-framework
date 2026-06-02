# Java & Spring Boot Code Patterns

> **Purpose:** Reusable Java and Spring Boot patterns for Guardian projects.
> **Source:** Guardian Framework — Java/Spring Support Module

---

## Clean Architecture Layering

```java
// Package structure with dependency direction:
//
//   interfaces/  (controllers, DTOs, web config)
//       ↓
//   application/  (use cases, ports, DTOs)
//       ↓
//   domain/       (entities, value objects, domain services)
//       ↑
//   infrastructure/ (repositories, JPA, external APIs, messaging)
//
// Rules:
//   domain/  → imports NOTHING from outside domain
//   application/ → imports ONLY domain/
//   infrastructure/ → imports domain/ + application/
//   interfaces/ → imports application/ only

// Example package structure
// com.myproject.domain.model/
// com.myproject.domain.service/
// com.myproject.application.port/
// com.myproject.application.usecase/
// com.myproject.infrastructure.persistence/
// com.myproject.infrastructure.messaging/
// com.myproject.interfaces.web/
// com.myproject.interfaces.config/
```

---

## Spring Annotations Reference

```java
// === STEREOTYPES ===
@Component      // Generic component (auto-detected via scanning)
@Service        // Business logic in application/domain layer
@Repository     // Data access (Spring adds PersistenceExceptionTranslation)
@Controller     // MVC controller (returns view name)
@RestController // REST controller (returns response body)

// === DEPENDENCY INJECTION ===
@Autowired          // Injects bean (use on constructors, not fields)
@Qualifier("name")  // Disambiguate when multiple beans of same type
@Primary            // Prefer this bean when multiple candidates
@Scope("prototype") // Non-singleton scope (default is singleton)

// === WEB LAYER ===
@RequestMapping("/api/users")      // Class-level mapping
@GetMapping("/{id}")               // GET
@PostMapping                       // POST
@PutMapping("/{id}")               // PUT
@DeleteMapping("/{id}")            // DELETE
@PatchMapping("/{id}")             // PATCH
@PathVariable("id")                // Path variable
@RequestParam("page")              // Query parameter
@RequestBody                       // Request body deserialization
@ResponseStatus(HttpStatus.CREATED)  // Response status override

// === DATA ===
@Transactional          // Transaction boundary (service layer)
@Transactional(readOnly = true)  // Read-only optimization
@Query("SELECT u FROM User u WHERE u.email = :email")
@Modifying              // Indicates an UPDATE/DELETE @Query
@Entity                 // JPA entity
@Table(name = "users")  // Table mapping
@Column(name = "email", nullable = false, unique = true)
@Id                     // Primary key
@GeneratedValue(strategy = GenerationType.IDENTITY)
@ManyToOne(fetch = FetchType.LAZY)
@OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
@Enumerated(EnumType.STRING)

// === SECURITY ===
@PreAuthorize("hasRole('ADMIN')")
@PostAuthorize("returnObject.owner == authentication.name")
@Secured("ROLE_ADMIN")
@RolesAllowed("ADMIN")

// === OBSERVABILITY ===
@Cacheable("users")
@CacheEvict(value = "users", allEntries = true)
@Scheduled(cron = "0 0 * * * *")
@Async
@EventListener
@EventListener(condition = "#event.success")

// === LIFECYCLE ===
@PostConstruct    // Init callback (ONLY in service/config/component packages)
@PreDestroy       // Cleanup callback
```

---

## Dependency Injection Patterns

```java
// ✅ PREFERRED: Constructor injection (immutable, testable, required deps)
@Service
public class UserService {
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public UserService(UserRepository userRepository,
                       NotificationService notificationService) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }
}

// ✅ ACCEPTABLE: Setter injection (optional dependencies)
@Service
public class AuditService {
    private MetricsCollector metricsCollector;

    @Autowired(required = false)
    public void setMetricsCollector(MetricsCollector metricsCollector) {
        this.metricsCollector = metricsCollector;
    }
}

// ❌ NEVER: Field injection (hard to test, breaks immutability, hidden deps)
@Service
public class BadService {
    @Autowired  // BAD
    private UserRepository userRepository;

    @Autowired  // BAD
    private NotificationService notificationService;
}
```

---

## JPA Patterns

```java
// === ENTITY DESIGN ===
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String orderNumber;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @Version
    private Long version;  // Optimistic locking

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    // Protected default constructor for JPA
    protected Order() {}

    // Business-meaningful constructor
    public Order(Customer customer, List<OrderItem> items) {
        this.customer = customer;
        this.items = new ArrayList<>(items);
        this.status = OrderStatus.PENDING;
        this.orderNumber = generateOrderNumber();
    }
}

// === REPOSITORY PATTERNS ===
public interface OrderRepository extends JpaRepository<Order, Long> {
    // Derived query
    List<Order> findByCustomerIdAndStatus(Long customerId, OrderStatus status);

    // JPQL query
    @Query("SELECT o FROM Order o WHERE o.orderNumber = :orderNumber")
    Optional<Order> findByOrderNumber(@Param("orderNumber") String orderNumber);

    // Native query
    @Query(value = "SELECT * FROM orders WHERE total > :amount", nativeQuery = true)
    List<Order> findOrdersAboveAmount(@Param("amount") BigDecimal amount);

    // Projection
    @Query("SELECT new com.myproject.application.dto.OrderSummary(o.id, o.orderNumber, o.status) FROM Order o")
    List<OrderSummary> findAllSummaries();

    // Pagination
    Page<Order> findByCustomerId(Long customerId, Pageable pageable);
}

// === AUDITING ===
@EntityListeners(AuditingEntityListener.class)
@Entity
@Table(name = "orders")
public class AuditableOrder {
    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String lastModifiedBy;
}
```

---

## Testing Patterns

```java
// === FULL CONTEXT TEST ===
@SpringBootTest
class UserServiceTest {
    @Autowired
    private UserService userService;

    @Test
    void shouldCreateUser() {
        // Given
        CreateUserCommand command = new CreateUserCommand("john@example.com", "John");

        // When
        User user = userService.createUser(command);

        // Then
        assertThat(user.getEmail()).isEqualTo("john@example.com");
        assertThat(user.getName()).isEqualTo("John");
    }
}

// === WEB LAYER TEST (sliced) ===
@WebMvcTest(UserController.class)
class UserControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    void shouldReturnUser() throws Exception {
        // Given
        given(userService.findById(1L)).willReturn(new UserDTO(1L, "John"));

        // When/Then
        mockMvc.perform(get("/api/users/1"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.name").value("John"));
    }
}

// === DATA LAYER TEST (sliced) ===
@DataJpaTest
class OrderRepositoryTest {
    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private OrderRepository orderRepository;

    @Test
    void shouldFindByCustomerId() {
        // Given
        Customer customer = new Customer("John");
        entityManager.persist(customer);
        Order order = new Order(customer, List.of());
        entityManager.persist(order);
        entityManager.flush();

        // When
        List<Order> found = orderRepository.findByCustomerId(customer.getId());

        // Then
        assertThat(found).hasSize(1);
        assertThat(found.get(0).getCustomer().getId()).isEqualTo(customer.getId());
    }
}
```

---

## Error Handling

```java
// === GLOBAL EXCEPTION HANDLER ===
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetail handleValidation(ValidationException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Validation Error");
        problem.setProperty("errors", ex.getErrors());
        return problem;
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN, "Access denied");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetail handleGeneric(Exception ex) {
        // Log full exception, return sanitized response
        log.error("Unexpected error", ex);
        return ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
    }
}

// === DOMAIN RESULTS ===
// For operations that can fail without exceptions
public sealed interface Result<T> {
    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error, Map<String, Object> details) implements Result<T> {}
}
```

---

## Configuration

```java
// === TYPE-SAFE CONFIGURATION ===
@ConfigurationProperties(prefix = "app.notification")
public class NotificationProperties {
    private String fromEmail;
    private List<String> adminEmails = new ArrayList<>();
    private Duration timeout = Duration.ofSeconds(30);
    private boolean enabled = true;

    // getters and setters
}

// === PROFILE-SPECIFIC CONFIG ===
// application-dev.yml
// application-prod.yml
// application-test.yml

// Active profile
@Profile("dev")
@Component
public class DevDataInitializer implements CommandLineRunner { ... }

// === CONDITIONAL BEANS ===
@ConditionalOnProperty(name = "app.feature.notifications", havingValue = "true")
@ConditionalOnClass(name = "com.amazonaws.services.sqs.AmazonSQS")
@ConditionalOnMissingBean(NotificationService.class)
```

---

## Transaction Management

```java
@Service
public class OrderService {

    // Required by default — joins existing or creates new
    @Transactional
    public Order createOrder(CreateOrderCommand command) {
        Order order = new Order(command.customer(), mapItems(command.items()));
        return orderRepository.save(order);
    }

    // Read-only optimization — hints JPA to skip dirty checking
    @Transactional(readOnly = true)
    public Optional<Order> findById(Long id) {
        return orderRepository.findById(id);
    }

    // Explicit rollback
    @Transactional(rollbackFor = InsufficientBalanceException.class)
    public void processPayment(Long orderId, BigDecimal amount) {
        // throws InsufficientBalanceException → rollback
    }

    // Isolation level
    @Transactional(isolation = Isolation.REPEATABLE_READ)
    public BigDecimal calculateDailyRevenue() { ... }

    // Propagation control
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAuditTrail(AuditEntry entry) {
        // Always runs in a new transaction
    }
}
```

---

## Anti-Patterns (NEVER DO)

```java
// ❌ Field injection
@Service
public class BadService {
    @Autowired private UserRepository userRepository;  // BAD
}

// ❌ @PostConstruct in controllers
@RestController
public class BadController {
    @PostConstruct  // BAD — lifecycle hooks don't belong in web layer
    public void init() { ... }
}

// ❌ Domain layer importing infrastructure
// package com.myproject.domain.model;
// import com.myproject.infrastructure.persistence.JpaUtils;  // BAD

// ❌ Direct repository access from web layer
@RestController
public class BadController {
    @Autowired private UserRepository userRepository;  // BAD — use service layer
}

// ❌ Unbounded @RequestMapping
@RequestMapping  // BAD — always specify path
public class VagueController { ... }

// ❌ Using RuntimeException directly
throw new RuntimeException("something failed");  // BAD — use specific exceptions

// ❌ Ignoring @Transactional on service methods
@Service
public class OrderService {
    public void createOrder(...) {  // BAD — no @Transactional
        // each JPA operation runs in its own transaction
    }
}

// ❌ Eager fetching in entity relationships
@ManyToOne(fetch = FetchType.EAGER)  // BAD — always use LAZY
```

---

## Build Commands

```bash
# Maven
mvn clean compile -q          # Build
mvn test -q                   # Test
mvn checkstyle:check -q       # Lint
mvn spotless:apply            # Format
mvn spotless:check            # Format check
mvn dependency-check:check    # Security audit
mvn verify                    # Full verification

# Gradle
gradle build -q               # Build
gradle test -q                # Test
gradle checkstyleMain -q      # Lint
gradle spotlessApply          # Format
gradle spotlessCheck          # Format check
gradle dependencyCheck        # Security audit
gradle check                  # Full verification
```

---

## Dependencies

```xml
<!-- Maven — spring-boot-starter-parent -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>

<dependencies>
    <!-- Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- JPA -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- Security -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <!-- Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- Database -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- Test -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- Observability -->
    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-tracing-bridge-brave</artifactId>
    </dependency>
</dependencies>
```
