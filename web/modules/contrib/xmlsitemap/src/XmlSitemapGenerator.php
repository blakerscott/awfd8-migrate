<?php

namespace Drupal\xmlsitemap;

use Drupal\Component\Utility\Bytes;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Database\Connection;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\State\StateInterface;
use Drupal\Core\Site\Settings;
use Drupal\Core\Url;
use Psr\Log\LoggerInterface;

/**
 * XmlSitemap generator service class.
 *
 * @todo Update all the methods in this class to match the procedural functions
 *   and start using the 'xmlsitemap_generator' service.
 */
class XmlSitemapGenerator implements XmlSitemapGeneratorInterface {

  /**
   * Aliases for links.
   *
   * @var array
   */
  public static $aliases;

  /**
   * Last used language.
   *
   * @var string
   *
   * @codingStandardsIgnoreStart
   */
  public static $last_language;

  /**
   * Memory used before generation process.
   *
   * @var int
   */
  public static $memory_start;

  /**
   * The xmlsitemap.settings config object.
   *
   * @var \Drupal\Core\Config\Config
   *
   * @codingStandardsIgnoreEnd
   */
  protected $config;

  /**
   * The language manager object.
   *
   * @var \Drupal\Core\Language\LanguageManager
   */
  protected $languageManager;

  /**
   * The state object.
   *
   * @var \Drupal\Core\State\State
   */
  protected $state;

  /**
   * A logger instance.
   *
   * @var \Psr\Log\LoggerInterface
   */
  protected $logger;

  /**
   * The module handler.
   *
   * @var \Drupal\Core\Extension\ModuleHandlerInterface
   */
  protected $moduleHandler;

  /**
   * The entity type manager.
   *
   * @var \Drupal\Core\Entity\EntityTypeManagerInterface
   */
  protected $entityTypeManager;

  /**
   * The database connection.
   *
   * @var \Drupal\Core\Database\Connection
   */
  protected $connection;

  /**
   * Constructs a XmlSitemapGenerator object.
   *
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The config factory object.
   * @param \Drupal\Core\State\StateInterface $state
   *   The state handler.
   * @param \Drupal\Core\Language\LanguageManagerInterface $language_manager
   *   Language Manager.
   * @param \Psr\Log\LoggerInterface $logger
   *   A logger instance.
   * @param \Drupal\Core\Extension\ModuleHandlerInterface $module_handler
   *   The module handler.
   * @param \Drupal\Core\Entity\EntityTypeManagerInterface $entity_type_manager
   *   The entity type manager.
   * @param \Drupal\Core\Database\Connection $connection
   *   The database connection.
   */
  public function __construct(ConfigFactoryInterface $config_factory, StateInterface $state, LanguageManagerInterface $language_manager, LoggerInterface $logger, ModuleHandlerInterface $module_handler, EntityTypeManagerInterface $entity_type_manager, Connection $connection) {
    $this->config = $config_factory->getEditable('xmlsitemap.settings');
    $this->state = $state;
    $this->languageManager = $language_manager;
    $this->logger = $logger;
    $this->moduleHandler = $module_handler;
    $this->entityTypeManager = $entity_type_manager;
    $this->connection = $connection;
  }

  /**
   * {@inheritdoc}
   */
  public function getPathAlias($path, $language) {
    $query = $this->connection->select('url_alias', 'u');
    $query->fields('u', ['source', 'alias']);
    if (!isset(static::$aliases)) {
      $query->condition('langcode', LanguageInterface::LANGCODE_NOT_SPECIFIED, '=');
      static::$aliases[LanguageInterface::LANGCODE_NOT_SPECIFIED] = $query->execute()->fetchAllKeyed();
    }
    if ($language != LanguageInterface::LANGCODE_NOT_SPECIFIED && static::$last_language != $language) {
      unset(static::$aliases[static::$last_language]);
      $query->condition('langcode', $language, '=');
      $query->orderBy('pid');
      static::$aliases[$language] = $query->execute()->fetchAllKeyed();
      static::$last_language = $language;
    }

    if ($language != LanguageInterface::LANGCODE_NOT_SPECIFIED && isset(static::$aliases[$language][$path])) {
      return static::$aliases[$language][$path];
    }
    elseif (isset(static::$aliases[LanguageInterface::LANGCODE_NOT_SPECIFIED][$path])) {
      return static::$aliases[LanguageInterface::LANGCODE_NOT_SPECIFIED][$path];
    }
    else {
      return $path;
    }
  }

  /**
   * {@inheritdoc}
   */
  public function regenerateBefore() {
    // Attempt to increase the memory limit.
    $this->setMemoryLimit();

    if ($this->state->get('xmlsitemap_developer_mode')) {
      $this->logger->notice('Starting XML sitemap generation. Memory usage: @memory-peak.', [
        '@memory-peak' => format_size(memory_get_peak_usage(TRUE)),
      ]);
    }
  }

  /**
   * {@inheritdoc}
   */
  public function getMemoryUsage($start = FALSE) {
    $current = memory_get_peak_usage(TRUE);
    if (!isset(self::$memory_start) || $start) {
      self::$memory_start = $current;
    }
    return $current - self::$memory_start;
  }

  /**
   * {@inheritdoc}
   */
  public function getOptimalMemoryLimit() {
    $optimal_limit = &drupal_static(__FUNCTION__);
    if (!isset($optimal_limit)) {
      // Set the base memory amount from the provided core constant.
      $optimal_limit = Bytes::toInt(DRUPAL_MINIMUM_PHP_MEMORY_LIMIT);

      // Add memory based on the chunk size.
      $optimal_limit += xmlsitemap_get_chunk_size() * 500;

      // Add memory for storing the url aliases.
      if ($this->config->get('prefetch_aliases')) {
        $aliases = $this->connection->query("SELECT COUNT(pid) FROM {url_alias}")->fetchField();
        $optimal_limit += $aliases * 250;
      }
    }
    return $optimal_limit;
  }

  /**
   * {@inheritdoc}
   */
  public function setMemoryLimit($new_limit = NULL) {
    $current_limit = @ini_get('memory_limit');
    if ($current_limit && $current_limit != -1) {
      if (!is_null($new_limit)) {
        $new_limit = $this->getOptimalMemoryLimit();
      }
      if (Bytes::toInt($current_limit) < $new_limit) {
        return @ini_set('memory_limit', $new_limit);
      }
    }
  }

  /**
   * {@inheritdoc}
   */
  public function generatePage(XmlSitemapInterface $sitemap, $page) {
    $writer = new XmlSitemapWriter($sitemap, $page);
    $writer->startDocument();
    $this->generateChunk($sitemap, $writer, $page);
    $writer->endDocument();
    return $writer->getSitemapElementCount();
  }

  /**
   * {@inheritdoc}
   */
  public function generateChunk(XmlSitemapInterface $sitemap, XmlSitemapWriter $writer, $chunk) {
    $lastmod_format = $this->config->get('lastmod_format');

    $url_options = $sitemap->uri['options'];
    $url_options += [
      'absolute' => TRUE,
      'base_url' => rtrim(Settings::get('xmlsitemap_base_url', $this->state->get('xmlsitemap_base_url')), '/'),
      'language' => $this->languageManager->getDefaultLanguage(),
      // @todo Figure out a way to bring back the alias preloading optimization.
      // 'alias' => $this->config->get('prefetch_aliases'),
      'alias' => FALSE,
    ];

    $last_url = '';
    $link_count = 0;

    $query = $this->connection->select('xmlsitemap', 'x');
    $query->fields('x', [
      'loc', 'type', 'subtype', 'lastmod', 'changefreq', 'changecount', 'priority', 'language', 'access', 'status',
    ]);
    $query->condition('x.access', 1);
    $query->condition('x.status', 1);
    $query->orderBy('x.language', 'DESC');
    $query->orderBy('x.loc');
    $query->addTag('xmlsitemap_generate');
    $query->addMetaData('sitemap', $sitemap);

    $offset = max($chunk - 1, 0) * xmlsitemap_get_chunk_size();
    $limit = xmlsitemap_get_chunk_size();
    $query->range($offset, $limit);
    $links = $query->execute();

    while ($link = $links->fetchAssoc()) {
      $link['language'] = $link['language'] != LanguageInterface::LANGCODE_NOT_SPECIFIED ? xmlsitemap_language_load($link['language']) : $url_options['language'];
      $link_options = [
        'language' => $link['language'],
        'xmlsitemap_link' => $link,
        'xmlsitemap_sitemap' => $sitemap,
      ];

      // Ensure every link starts with a slash.
      // @see \Drupal\Core\Url::fromInternalUri()
      if ($link['loc'][0] !== '/') {
        trigger_error(t('The XML sitemap link path %path for @type @id is invalid because it does not start with a slash.', ['%path' => $link['loc'], '@type' => $link['type'], '@id' => $link['id']]), E_USER_ERROR);
        $link['loc'] = '/' . $link['loc'];
      }

      // @todo Add a separate hook_xmlsitemap_link_url_alter() here?
      $link_url = Url::fromUri('internal:' . $link['loc'], $link_options + $url_options)->toString();

      // Skip this link if it was a duplicate of the last one.
      // @todo Figure out a way to do this before generation so we can report
      // back to the user about this.
      if ($link_url == $last_url) {
        continue;
      }
      else {
        $last_url = $link_url;
        // Keep track of the total number of links written.
        $link_count++;
      }

      $element = [];
      $element['loc'] = $link_url;
      if ($link['lastmod']) {
        $element['lastmod'] = gmdate($lastmod_format, $link['lastmod']);
        // If the link has a lastmod value, update the changefreq so that links
        // with a short changefreq but updated two years ago show decay.
        // We use abs() here just incase items were created on this same cron
        // run because lastmod would be greater than REQUEST_TIME.
        $link['changefreq'] = (abs(REQUEST_TIME - $link['lastmod']) + $link['changefreq']) / 2;
      }
      if ($link['changefreq']) {
        $element['changefreq'] = xmlsitemap_get_changefreq($link['changefreq']);
      }
      if (isset($link['priority']) && $link['priority'] != 0.5) {
        // Don't output the priority value for links that have 0.5 priority.
        // This is the default 'assumed' value if priority is not included as
        // per the sitemaps.org specification.
        $element['priority'] = number_format($link['priority'], 1);
      }

      // @todo Should this be moved to XMLSitemapWriter::writeSitemapElement()?
      $this->moduleHandler->alter('xmlsitemap_element', $element, $link, $sitemap);

      $writer->writeElement('url', $element);
    }

    return $link_count;
  }

  /**
   * {@inheritdoc}
   */
  public function generateIndex(XmlSitemapInterface $sitemap, $pages = NULL) {
    $writer = new XmlSitemapWriter($sitemap, 'index');
    $writer->startDocument();

    $lastmod_format = $this->config->get('lastmod_format');

    $url_options = $sitemap->uri['options'];
    $url_options += [
      'absolute' => TRUE,
      'xmlsitemap_base_url' => $this->state->get('xmlsitemap_base_url'),
      'language' => $this->languageManager->getDefaultLanguage(),
      'alias' => TRUE,
    ];

    if (!isset($pages)) {
      $pages = $sitemap->getChunks();
    }

    for ($current_page = 1; $current_page <= $pages; $current_page++) {
      $url_options['query']['page'] = $current_page;
      $element = [
        'loc' => Url::fromRoute('xmlsitemap.sitemap_xml', [], $url_options)->toString(),
        // @todo Use the actual lastmod value of the chunk file.
        'lastmod' => gmdate($lastmod_format, REQUEST_TIME),
      ];

      // @todo SHould the element be altered?

      $writer->writeElement('sitemap', $element);
    }

    $writer->endDocument();
    return $writer->getSitemapElementCount();
  }

  /**
   * {@inheritdoc}
   */
  public function regenerateBatchGenerate($smid, &$context) {
    if (!isset($context['sandbox']['sitemap'])) {
      $context['sandbox']['sitemap'] = $this->entityTypeManager->getStorage('xmlsitemap')->load($smid);
      $context['sandbox']['sitemap']->setChunks(1);
      $context['sandbox']['sitemap']->setLinks(0);
      $context['sandbox']['max'] = XMLSITEMAP_MAX_SITEMAP_LINKS;

      // Clear the cache directory for this sitemap before generating any files.
      xmlsitemap_check_directory($context['sandbox']['sitemap']);
      xmlsitemap_clear_directory($context['sandbox']['sitemap']);
    }

    /** @var \Drupal\xmlsitemap\XmlSitemapInterface $sitemap */
    $sitemap = &$context['sandbox']['sitemap'];

    try {
      $links = $this->generatePage($sitemap, $sitemap->getChunks());
    }
    catch (\Exception $e) {
      // @todo Should this use watchdog_exception()?
      $this->logger->error($e);
    }

    if (!empty($links)) {
      $context['message'] = t('Generated %sitemap-url with @count links.', [
        '%sitemap-url' => Url::fromRoute('xmlsitemap.sitemap_xml', [], $sitemap->uri['options'] + ['query' => ['page' => $sitemap->getChunks()]])->toString(),
        '@count' => $links,
      ]);
      $sitemap->setLinks($sitemap->getLinks() + $links);
      $sitemap->setChunks($sitemap->getChunks() + 1);
    }
    else {
      // Cleanup the 'extra' empty file.
      $file = xmlsitemap_sitemap_get_file($sitemap, $sitemap->getChunks());
      if (file_exists($file) && $sitemap->getChunks() > 1) {
        file_unmanaged_delete($file);
      }
      $sitemap->setChunks($sitemap->getChunks() - 1);

      // Save the updated chunks and links values.
      $context['sandbox']['max'] = $sitemap->getChunks();
      $sitemap->setUpdated(REQUEST_TIME);
      xmlsitemap_sitemap_get_max_filesize($sitemap);
      xmlsitemap_sitemap_save($sitemap);

      $context['finished'] = 1;
      return;
    }

    if ($sitemap->getChunks() < $context['sandbox']['max']) {
      $context['finished'] = $sitemap->getChunks() / $context['sandbox']['max'];
    }
  }

  /**
   * {@inheritdoc}
   */
  public function regenerateBatchGenerateIndex($smid, &$context) {
    $sitemap = xmlsitemap_sitemap_load($smid);
    if ($sitemap != NULL && $sitemap->getChunks() > 1) {
      try {
        $this->generateIndex($sitemap);
      }
      catch (\Exception $e) {
        // @todo Should this use watchdog_exception()?
        $this->logger->error($e);
      }
      $context['message'] = t('Generated sitemap index %sitemap-url.', [
        '%sitemap-url' => Url::fromRoute('xmlsitemap.sitemap_xml', [], $sitemap->uri['options'])->toString(),
      ]);
    }
  }

  /**
   * {@inheritdoc}
   */
  public function regenerateBatchFinished($success, array $results, array $operations, $elapsed) {
    if ($success && $this->state->get('xmlsitemap_regenerate_needed') == FALSE) {
      $this->state->set('xmlsitemap_generated_last', REQUEST_TIME);
      drupal_set_message(t('The sitemaps were regenerated.'));

      // Show a watchdog message that the sitemap was regenerated.
      $this->logger->notice('Finished XML sitemap generation in @elapsed. Memory usage: @memory-peak.', ['@elapsed' => $elapsed, '@memory-peak' => format_size(memory_get_peak_usage(TRUE))]);
    }
    else {
      drupal_set_message(t('The sitemaps were not successfully regenerated.'), 'error');
    }
  }

  /**
   * {@inheritdoc}
   */
  public function rebuildBatchClear(array $entity_type_ids, $save_custom, &$context) {
    if (!empty($entity_type_ids)) {
      // Let other modules respond to the rebuild clearing.
      $this->moduleHandler->invokeAll('xmlsitemap_rebuild_clear', [$entity_type_ids, $save_custom]);

      $query = db_delete('xmlsitemap');
      $query->condition('type', $entity_type_ids, 'IN');

      // If we want to save the custom data, make sure to exclude any links
      // that are not using default inclusion or priority.
      if ($save_custom) {
        $query->condition('status_override', 0);
        $query->condition('priority_override', 0);
      }

      $query->execute();
    }

    $context['message'] = t('Links cleared');
  }

  /**
   * {@inheritdoc}
   */
  public function rebuildBatchFetch($entity_type_id, &$context) {
    if (!isset($context['sandbox']['info'])) {
      $context['sandbox']['info'] = xmlsitemap_get_link_info($entity_type_id);
      $context['sandbox']['bundles'] = xmlsitemap_get_link_type_enabled_bundles($entity_type_id);
      $context['sandbox']['progress'] = 0;
      $context['sandbox']['last_id'] = 0;
    }

    if (empty($context['sandbox']['bundles'])) {
      return;
    }

    $info = $context['sandbox']['info'];
    $entity_type = $this->entityTypeManager->getDefinition($entity_type_id);

    $query = $this->entityTypeManager->getStorage($entity_type_id)->getQuery();
    $query->condition($entity_type->getKey('id'), $context['sandbox']['last_id'], '>');
    if ($entity_type->hasKey('bundle')) {
      $query->condition($entity_type->getKey('bundle'), $context['sandbox']['bundles'], 'IN');
    }
    $query->addTag('xmlsitemap_link_bundle_access');
    $query->addTag('xmlsitemap_rebuild');
    $query->addMetaData('entity_type_id', $entity_type_id);
    $query->addMetaData('entity_info', $info);

    if (!isset($context['sandbox']['max'])) {
      $count_query = clone $query;
      $count_query->count();
      $context['sandbox']['max'] = $count_query->execute();
      if (!$context['sandbox']['max']) {
        // If there are no items to process, skip everything else.
        return;
      }
    }

    // PostgreSQL cannot have the ORDERED BY in the count query.
    $query->sort($entity_type->getKey('id'));

    // Get batch limit.
    $limit = $this->config->get('batch_limit');
    $query->range(0, $limit);

    $result = $query->execute();

    $info['xmlsitemap']['process callback']($entity_type_id, $result);
    $context['sandbox']['last_id'] = end($result);
    $context['sandbox']['progress'] += count($result);
    $context['message'] = t('Processed %entity_type_id @last_id (@progress of @count).', [
      '%entity_type_id' => $entity_type_id,
      '@last_id' => $context['sandbox']['last_id'],
      '@progress' => $context['sandbox']['progress'],
      '@count' => $context['sandbox']['max'],
    ]);

    if ($context['sandbox']['progress'] >= $context['sandbox']['max']) {
      $context['finished'] = 1;
    }
    else {
      $context['finished'] = $context['sandbox']['progress'] / $context['sandbox']['max'];
    }
  }

  /**
   * {@inheritdoc}
   */
  public function rebuildBatchFinished($success, array $results, array $operations, $elapsed) {
    if ($success && !\Drupal::state()->get('xmlsitemap_rebuild_needed', FALSE)) {
      drupal_set_message(t('The sitemap links were rebuilt.'));
    }
    else {
      drupal_set_message(t('The sitemap links were not successfully rebuilt.'), 'error');
    }
  }

  /**
   * {@inheritdoc}
   */
  public function batchVariableSet(array $variables) {
    $state_variables = xmlsitemap_state_variables();
    foreach ($variables as $variable => $value) {
      if (isset($state_variables[$variable])) {
        $this->state->set($variable, $value);
      }
      else {
        $this->config->set($variable, $value);
        $this->config->save();
      }
    }
  }

}